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
import { BillingLedgerAccountCode } from '../../../../billing/ledger/constants/billing.constants';
import {
	accountBalances,
	RecordingLedger,
} from '../../../../billing/usage/testing/recording-ledger.fake';
import { fakeInstance } from '../../../../common/testing/instance.fake';
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import {
	STRIPE_API_VERSION,
	StripeMetadataKey,
} from '../../constants/stripe.constants';
import { TopUp } from '../../entities/top-up.entity';
import { TopUpKind } from '../../enums/top-up-kind.enum';
import { TopUpState } from '../../enums/top-up-state.enum';
import { AutoTopUpService } from '../auto-top-up.service';
import { PaymentMethodService } from '../payment-method.service';
import { PaymentVelocityService } from '../payment-velocity.service';
import { StripePaymentEventService } from './stripe-payment-event.service';

const ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const OTHER_ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000009';
const TOP_UP_ID = '7a000000-0000-4000-8000-000000000007';
const PAYMENT_INTENT_ID = 'pi_fixture';
const CREDIT_CENTS = 10_000;
const TAX_CENTS = 800;
const CREATED_SECONDS = 1_791_976_000;

function intent(organizationId = ORGANIZATION_ID) {
	return {
		id: PAYMENT_INTENT_ID,
		object: 'payment_intent',
		status: 'succeeded',
		amount_received: CREDIT_CENTS + TAX_CENTS,
		currency: 'usd',
		created: CREATED_SECONDS,
		latest_charge: null,
		payment_method: null,
		metadata: {
			[StripeMetadataKey.TOP_UP_ID]: TOP_UP_ID,
			[StripeMetadataKey.ORGANIZATION_ID]: organizationId,
		},
	};
}

function autoTopUp(): TopUp {
	return Object.assign(new TopUp(), {
		id: TOP_UP_ID,
		organizationId: ORGANIZATION_ID,
		kind: TopUpKind.AUTO,
		amountCents: CREDIT_CENTS,
		taxCents: TAX_CENTS,
	});
}

async function harness(stored: TopUp | null, organizationId = ORGANIZATION_ID) {
	const retrievals: string[] = [];
	const stripe = new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		httpClient: Stripe.createFetchHttpClient(
			async (input: string | URL | Request) => {
				retrievals.push(new URL(String(input)).pathname);
				return Response.json(intent(organizationId));
			}
		),
	});
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'fork', () => manager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'findOne', async () => stored);
	const notified = await stripe.paymentIntents.retrieve(PAYMENT_INTENT_ID);
	retrievals.length = 0;
	const ledger = new RecordingLedger();
	const autoTopUps = fakeInstance(AutoTopUpService);
	const firstSuccess = mock.method(autoTopUps, 'recordSuccess', async () => {});
	const velocity = fakeInstance(PaymentVelocityService);
	mock.method(velocity, 'enforceCardFingerprint', async () => {});
	const service = new StripePaymentEventService(
		manager,
		stripe,
		ledger,
		fakeInstance(PaymentMethodService),
		autoTopUps,
		velocity
	);
	return {
		service,
		stripe,
		ledger,
		firstSuccess,
		retrievals,
		notified,
	};
}

describe('StripePaymentEventService top-up crediting', () => {
	it('credits the amount received net of the stored tax and records the first success', async () => {
		const topUp = autoTopUp();
		const { service, ledger, firstSuccess, notified } = await harness(topUp);

		await service.paymentIntentSucceeded(notified);

		const balances = accountBalances(ledger.postings);
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.CUSTOMER_CREDIT),
			MicroUsd.fromCents(CREDIT_CENTS).negate()
		);
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.SALES_TAX_PAYABLE),
			MicroUsd.fromCents(TAX_CENTS).negate()
		);
		assert.equal(topUp.state, TopUpState.SUCCEEDED);
		assert.equal(topUp.amountCents, CREDIT_CENTS);
		assert.equal(firstSuccess.mock.callCount(), 1);
	});

	it('posts a top-up for dispute and refund handlers without first-success side effects', async () => {
		const { service, ledger, firstSuccess, notified } = await harness(
			autoTopUp()
		);

		await service.ensureTopUpPosted(notified);

		assert.equal(ledger.postings.length, 1);
		assert.equal(firstSuccess.mock.callCount(), 0);
	});

	it('ignores a payment intent whose metadata names another organization', async () => {
		const { service, ledger, retrievals, notified } = await harness(
			autoTopUp(),
			OTHER_ORGANIZATION_ID
		);

		await service.paymentIntentSucceeded(notified);

		assert.deepEqual(ledger.postings, []);
		assert.deepEqual(retrievals, []);
	});

	it('ignores a payment intent of a top-up this deployment does not know', async () => {
		const { service, ledger, notified } = await harness(null);

		await service.paymentIntentSucceeded(notified);

		assert.deepEqual(ledger.postings, []);
	});
});
