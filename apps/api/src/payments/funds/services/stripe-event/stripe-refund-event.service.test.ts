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
} from '../../../../billing/ledger/constants/billing.constants';
import { BillingLedgerTransaction } from '../../../../billing/ledger/entities/billing-ledger-transaction.entity';
import {
	accountBalances,
	RecordingLedger,
} from '../../../../billing/usage/testing/recording-ledger.fake';
import { fakeInstance } from '../../../../common/testing/instance.fake';
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { STRIPE_API_VERSION } from '../../constants/stripe.constants';
import { TopUp } from '../../entities/top-up.entity';
import { TopUpKind } from '../../enums/top-up-kind.enum';
import {
	refundSplit,
	refundSplitMetadata,
} from '../../utils/stripe-refund.util';
import { StripePaymentEventService } from './stripe-payment-event.service';
import { StripeRefundEventService } from './stripe-refund-event.service';

const ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const REFUND_ID = 're_fixture';
const CREDIT_CENTS = 10_000;
const TAX_CENTS = 800;
const SPENDABLE_MICRO_USD = '25000000';
const CREATED_SECONDS = 1_791_976_000;

function topUp(): TopUp {
	return Object.assign(new TopUp(), {
		id: '7a000000-0000-4000-8000-000000000007',
		organizationId: ORGANIZATION_ID,
		kind: TopUpKind.MANUAL,
		amountCents: CREDIT_CENTS,
		taxCents: TAX_CENTS,
	});
}

function refund(status: string, balanceTransaction: string | null) {
	return {
		id: REFUND_ID,
		object: 'refund',
		amount: CREDIT_CENTS + TAX_CENTS,
		currency: 'usd',
		created: CREATED_SECONDS,
		status,
		balance_transaction: balanceTransaction,
		failure_balance_transaction: null,
		payment_intent: {
			id: 'pi_fixture',
			object: 'payment_intent',
			status: 'succeeded',
			metadata: {},
		},
	};
}

async function harness(
	remote: ReturnType<typeof refund>,
	posted: BillingLedgerTransaction | null
) {
	const stripe = new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		httpClient: Stripe.createFetchHttpClient(async () => Response.json(remote)),
	});
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'fork', () => manager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'execute', async () => [
		{ balance: SPENDABLE_MICRO_USD, total: '0' },
	]);
	mock.method(manager, 'findOneOrFail', async () => topUp());
	mock.method(manager, 'findOne', async () => posted);
	const payments = fakeInstance(StripePaymentEventService);
	mock.method(payments, 'ownedTopUp', async () => topUp());
	const ensured = mock.method(payments, 'ensureTopUpPosted', async () => {});
	const ledger = new RecordingLedger();
	const service = new StripeRefundEventService(
		manager,
		stripe,
		ledger,
		payments
	);
	return {
		service,
		ledger,
		ensured,
		notified: await stripe.refunds.retrieve(REFUND_ID),
	};
}

describe('StripeRefundEventService', () => {
	it('debits the spendable credit and books the spent rest as a refund loss', async () => {
		const { service, ledger, ensured, notified } = await harness(
			refund('succeeded', 'txn_refund'),
			null
		);

		await service.refundChanged(notified);

		assert.equal(ensured.mock.callCount(), 1);
		assert.deepEqual(
			ledger.postings.map((posting) => posting.sourceType),
			[BillingLedgerSourceType.STRIPE_REFUND]
		);
		const balances = accountBalances(ledger.postings);
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.CUSTOMER_CREDIT),
			MicroUsd.parse(SPENDABLE_MICRO_USD)
		);
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.SALES_TAX_PAYABLE),
			MicroUsd.fromCents(TAX_CENTS)
		);
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.REFUND_LOSSES),
			MicroUsd.fromCents(CREDIT_CENTS).subtract(
				MicroUsd.parse(SPENDABLE_MICRO_USD)
			)
		);
	});

	it('mirrors the posted split once the refund fails', async () => {
		const split = refundSplit(
			CREDIT_CENTS + TAX_CENTS,
			'usd',
			topUp(),
			MicroUsd.parse(SPENDABLE_MICRO_USD)
		);
		const posted = Object.assign(new BillingLedgerTransaction(), {
			metadata: refundSplitMetadata(split),
		});
		const { service, ledger, notified } = await harness(
			refund('failed', 'txn_refund'),
			posted
		);

		await service.refundChanged(notified);

		assert.deepEqual(
			ledger.postings.map((posting) => posting.sourceType),
			[BillingLedgerSourceType.STRIPE_REFUND_FAILURE]
		);
		assert.deepEqual(
			accountBalances(ledger.postings).get(
				BillingLedgerAccountCode.CUSTOMER_CREDIT
			),
			split.creditMicroUsd.negate()
		);
	});

	it('waits until the refund moves money', async () => {
		const { service, ledger, ensured, notified } = await harness(
			refund('requires_action', null),
			null
		);

		await service.refundChanged(notified);

		assert.equal(ensured.mock.callCount(), 0);
		assert.deepEqual(ledger.postings, []);
	});
});
