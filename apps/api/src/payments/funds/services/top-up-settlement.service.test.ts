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
import { fakeInstance } from '../../../common/testing/instance.fake';
import { TOP_UP_SETTLEMENT } from '../constants/payments.constants';
import { STRIPE_API_VERSION } from '../constants/stripe.constants';
import { TopUp } from '../entities/top-up.entity';
import { TopUpKind } from '../enums/top-up-kind.enum';
import { TopUpState } from '../enums/top-up-state.enum';
import { StripePaymentEventService } from './stripe-event/stripe-payment-event.service';
import { TopUpSettlementService } from './top-up-settlement.service';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const PAID_SESSION = 'cs_paid';
const BROKEN_SESSION = 'cs_broken';
const PAYMENT_INTENT_ID = 'pi_paid';
const MISSING_SESSION = 'cs_missing';
const SERVER_ERROR = 500;
const NOT_FOUND = 404;

function staleTopUp(id: string, sessionId: string): TopUp {
	return Object.assign(new TopUp(), {
		id,
		organizationId: '6f000000-0000-4000-8000-000000000006',
		kind: TopUpKind.MANUAL,
		amountCents: 2_500,
		stripeCheckoutSessionId: sessionId,
		createdAt: new Date(0),
	});
}

function sessionStripe(): Stripe {
	return new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		maxNetworkRetries: 0,
		httpClient: Stripe.createFetchHttpClient(
			async (input: string | URL | Request) => {
				const path = new URL(String(input)).pathname;
				if (path.endsWith(MISSING_SESSION)) {
					return Response.json(
						{
							error: {
								type: 'invalid_request_error',
								code: 'resource_missing',
								message: `No such checkout.session: ${MISSING_SESSION}`,
							},
						},
						{ status: NOT_FOUND }
					);
				}
				if (path.endsWith(BROKEN_SESSION)) {
					return Response.json(
						{ error: { type: 'api_error', message: 'unavailable' } },
						{ status: SERVER_ERROR }
					);
				}
				return Response.json({
					id: PAID_SESSION,
					object: 'checkout.session',
					status: 'complete',
					payment_intent: {
						id: PAYMENT_INTENT_ID,
						object: 'payment_intent',
						status: 'succeeded',
					},
				});
			}
		),
	});
}

describe('TopUpSettlementService.settleStale', () => {
	it('credits paid Checkout top-ups past the grace period and isolates failures', async () => {
		const broken = staleTopUp(
			'7a000000-0000-4000-8000-000000000001',
			BROKEN_SESSION
		);
		const paid = staleTopUp(
			'7a000000-0000-4000-8000-000000000002',
			PAID_SESSION
		);
		const manager = fakeInstance(EntityManager);
		mock.method(manager, 'fork', () => manager);
		mock.method(manager, 'execute', async () => [{ now: NOW }]);
		const find = mock.method(manager, 'find', async () => [broken, paid]);
		mock.method(manager, 'findOneOrFail', async () => paid);
		const payments = fakeInstance(StripePaymentEventService);
		mock.method(payments, 'checkoutSessionCompleted', async () => {});
		const credited = mock.method(
			payments,
			'paymentIntentSucceeded',
			async () => {}
		);
		const service = new TopUpSettlementService(
			manager,
			sessionStripe(),
			payments
		);

		await service.settleStale();

		assert.equal(credited.mock.callCount(), 1);
		assert.equal(credited.mock.calls[0]?.arguments[0]?.id, PAYMENT_INTENT_ID);
		const [, where, options] = find.mock.calls[0]?.arguments ?? [];
		assert.deepEqual(where, {
			kind: TopUpKind.MANUAL,
			state: TopUpState.CREATED,
			stripeCheckoutSessionId: { $ne: null },
			createdAt: {
				$lte: new Date(NOW.getTime() - TOP_UP_SETTLEMENT.graceMilliseconds),
			},
		});
		assert.equal(options?.limit, TOP_UP_SETTLEMENT.batchSize);
	});
});

describe('TopUpSettlementService.settle', () => {
	it('expires a top-up whose Checkout session Stripe no longer has', async () => {
		const missing = staleTopUp(
			'7a000000-0000-4000-8000-000000000003',
			MISSING_SESSION
		);
		const manager = fakeInstance(EntityManager);
		mock.method(manager, 'fork', () => manager);
		const updates = mock.method(manager, 'nativeUpdate', async () => 1);
		mock.method(manager, 'findOneOrFail', async () =>
			Object.assign(missing, { state: TopUpState.EXPIRED })
		);
		const service = new TopUpSettlementService(
			manager,
			sessionStripe(),
			fakeInstance(StripePaymentEventService)
		);

		const settled = await service.settle(
			staleTopUp(missing.id, MISSING_SESSION)
		);

		assert.equal(settled.state, TopUpState.EXPIRED);
		assert.deepEqual(updates.mock.calls[0]?.arguments.slice(1), [
			{
				id: missing.id,
				stripeCheckoutSessionId: MISSING_SESSION,
				state: TopUpState.CREATED,
			},
			{ state: TopUpState.EXPIRED },
		]);
	});
});
