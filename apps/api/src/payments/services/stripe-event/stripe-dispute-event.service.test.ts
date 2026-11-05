/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import Stripe from 'stripe';
import {
	BillingLedgerAccountCode,
	BillingLedgerSourceType,
} from '../../../billing/constants/billing.constants';
import {
	accountBalances,
	RecordingLedger,
} from '../../../billing/usage/testing/recording-ledger.fake';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { STRIPE_API_VERSION } from '../../constants/stripe.constants';
import { PaymentDispute } from '../../entities/payment-dispute.entity';
import { TopUp } from '../../entities/top-up.entity';
import { DisputeState } from '../../enums/dispute-state.enum';
import { PaymentSuspensionService } from '../payment-suspension.service';
import { StripeDisputeEventService } from './stripe-dispute-event.service';
import { StripePaymentEventService } from './stripe-payment-event.service';

const ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const TOP_UP_ID = '7a000000-0000-4000-8000-000000000007';
const CHARGE_ID = 'ch_fixture';
const PAYMENT_INTENT_ID = 'pi_fixture';
const DISPUTE_ID = 'du_fixture';
const DISPUTE_CREATED_SECONDS = 1_791_976_000;
const DISPUTED_CENTS = 2_500;
const DISPUTE_FEE_CENTS = 1_500;
const SECONDS_BETWEEN_TRANSACTIONS = 86_400;
const SPENDABLE_MICRO_USD = '10000000';

function prototypeOf<Service extends object>(
	service: abstract new (...args: never[]) => Service
): Service {
	return Object.create(service.prototype);
}

const WITHDRAWAL = {
	id: 'txn_withdrawal',
	object: 'balance_transaction',
	amount: -DISPUTED_CENTS,
	fee: DISPUTE_FEE_CENTS,
	currency: 'usd',
	created: DISPUTE_CREATED_SECONDS,
};

const REINSTATEMENT = {
	id: 'txn_reinstatement',
	object: 'balance_transaction',
	amount: DISPUTED_CENTS,
	fee: -DISPUTE_FEE_CENTS,
	currency: 'usd',
	created: DISPUTE_CREATED_SECONDS + SECONDS_BETWEEN_TRANSACTIONS,
};

function stripeObjects(
	status: Stripe.Dispute.Status,
	balanceTransactions: readonly object[]
): Readonly<Record<string, object>> {
	return {
		[`/v1/charges/${CHARGE_ID}`]: {
			id: CHARGE_ID,
			object: 'charge',
			payment_intent: {
				id: PAYMENT_INTENT_ID,
				object: 'payment_intent',
				status: 'succeeded',
				metadata: {},
			},
		},
		[`/v1/disputes/${DISPUTE_ID}`]: {
			id: DISPUTE_ID,
			object: 'dispute',
			amount: DISPUTED_CENTS,
			charge: CHARGE_ID,
			created: DISPUTE_CREATED_SECONDS,
			status,
			reason: 'fraudulent',
			balance_transactions: balanceTransactions,
			evidence_details: null,
		},
	};
}

function fixtureStripe(objects: Readonly<Record<string, object>>): Stripe {
	return new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		httpClient: Stripe.createFetchHttpClient(
			async (input: string | URL | Request) =>
				Response.json(objects[new URL(String(input)).pathname] ?? {})
		),
	});
}

function harness(
	status: Stripe.Dispute.Status,
	balanceTransactions: readonly object[]
) {
	const manager = prototypeOf(EntityManager);
	mock.method(manager, 'fork', () => manager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'execute', async () => [
		{ now: new Date(0), balance: SPENDABLE_MICRO_USD, total: '0' },
	]);
	mock.method(manager, 'count', async () => 0);
	mock.method(manager, 'persist', () => manager);
	const record = Object.assign(new PaymentDispute(), {
		stripeDisputeId: DISPUTE_ID,
		organizationId: ORGANIZATION_ID,
		topUpId: TOP_UP_ID,
		state: DisputeState.NEEDS_RESPONSE,
		frozenMicroUsd: '0',
	});
	mock.method(manager, 'findOne', async () => record);

	const ledger = new RecordingLedger();
	const payments = prototypeOf(StripePaymentEventService);
	mock.method(payments, 'ownedTopUp', async () =>
		Object.assign(new TopUp(), {
			id: TOP_UP_ID,
			organizationId: ORGANIZATION_ID,
		})
	);
	const postingsWhenCredited: number[] = [];
	const ensured = mock.method(payments, 'ensureTopUpPosted', async () => {
		postingsWhenCredited.push(ledger.postings.length);
	});
	const succeeded = mock.method(
		payments,
		'paymentIntentSucceeded',
		async () => undefined
	);
	const stripe = fixtureStripe(stripeObjects(status, balanceTransactions));
	const service = new StripeDisputeEventService(
		manager,
		stripe,
		ledger,
		prototypeOf(PaymentSuspensionService),
		payments
	);
	return {
		service,
		stripe,
		ledger,
		ensured,
		succeeded,
		postingsWhenCredited,
	};
}

describe('StripeDisputeEventService', () => {
	it('credits the disputed top-up through the ledger only, before any dispute posting', async () => {
		const { service, stripe, ensured, succeeded, postingsWhenCredited } =
			harness('needs_response', [WITHDRAWAL]);

		await service.disputeChanged(await stripe.disputes.retrieve(DISPUTE_ID));

		assert.equal(ensured.mock.callCount(), 1);
		assert.equal(ensured.mock.calls[0]?.arguments[0]?.id, PAYMENT_INTENT_ID);
		assert.deepEqual(postingsWhenCredited, [0]);
		assert.equal(succeeded.mock.callCount(), 0);
	});

	it('freezes at most the spendable credit while the funds are withdrawn', async () => {
		const { service, stripe, ledger } = harness('needs_response', [WITHDRAWAL]);

		await service.disputeChanged(await stripe.disputes.retrieve(DISPUTE_ID));

		assert.deepEqual(
			ledger.postings.map((posting) => posting.sourceType),
			[
				BillingLedgerSourceType.STRIPE_DISPUTE_WITHDRAWAL,
				BillingLedgerSourceType.STRIPE_DISPUTE_FREEZE,
			]
		);
		assert.deepEqual(
			accountBalances(ledger.postings).get(
				BillingLedgerAccountCode.CUSTOMER_CREDIT
			),
			MicroUsd.parse(SPENDABLE_MICRO_USD)
		);
	});

	it('never freezes credit when the reinstatement is synced before the withdrawal event', async () => {
		const { service, stripe, ledger } = harness('under_review', [
			REINSTATEMENT,
			WITHDRAWAL,
		]);

		await service.disputeChanged(await stripe.disputes.retrieve(DISPUTE_ID));

		assert.deepEqual(
			ledger.postings.map((posting) => posting.sourceType),
			[
				BillingLedgerSourceType.STRIPE_DISPUTE_WITHDRAWAL,
				BillingLedgerSourceType.STRIPE_DISPUTE_REINSTATEMENT,
			]
		);
		const balances = accountBalances(ledger.postings);
		assert.equal(
			balances.get(BillingLedgerAccountCode.CUSTOMER_CREDIT),
			undefined
		);
		assert.ok(balances.get(BillingLedgerAccountCode.DISPUTED_FUNDS)?.isZero());
	});

	it('does not freeze credit of a dispute that is already won', async () => {
		const { service, stripe, ledger } = harness('won', [WITHDRAWAL]);

		await service.disputeChanged(await stripe.disputes.retrieve(DISPUTE_ID));

		assert.deepEqual(
			ledger.postings.map((posting) => posting.sourceType),
			[BillingLedgerSourceType.STRIPE_DISPUTE_WITHDRAWAL]
		);
	});
});
