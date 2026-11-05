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
import { fakeInstance } from '../../common/testing/instance.fake';
import { fakeSettings } from '../../settings/testing/settings.fake';
import { STRIPE_API_VERSION } from '../constants/stripe.constants';
import { AutoTopUpPolicy } from '../entities/auto-top-up-policy.entity';
import { PaymentAccount } from '../entities/payment-account.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { TopUp } from '../entities/top-up.entity';
import { TopUpKind } from '../enums/top-up-kind.enum';
import { AutoTopUpChargeService } from './auto-top-up-charge.service';
import { AutoTopUpTaxService } from './auto-top-up-tax.service';
import { PaymentMethodService } from './payment-method.service';
import { StripePaymentEventService } from './stripe-event/stripe-payment-event.service';

const ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const PAYMENT_METHOD_ID = '7b000000-0000-4000-8000-000000000001';
const PENDING_PAYMENT_INTENT = 'pi_pending';
const NEW_PAYMENT_INTENT = 'pi_new';
const PAYMENT_INTENTS_PATH = '/v1/payment_intents';
const CANDIDATE_MARKER = 'auto_top_up_policy';
const AMOUNT_CENTS = 2_500;
const NOW = new Date('2026-10-21T12:00:00.000Z');

const PAYMENT_INTENT_SEARCH_PATH = `${PAYMENT_INTENTS_PATH}/search`;
const BAD_REQUEST = 400;

interface HarnessOptions {
	searchHits?: number;
	rejectCharge?: boolean;
}

function pendingIntent() {
	return {
		id: PENDING_PAYMENT_INTENT,
		object: 'payment_intent',
		status: 'succeeded',
		metadata: {},
	};
}

function harness(
	pending: TopUp | null,
	{ searchHits = 0, rejectCharge = false }: HarnessOptions = {}
) {
	const timeline: string[] = [];
	const stripe = new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		maxNetworkRetries: 0,
		httpClient: Stripe.createFetchHttpClient(
			async (input: string | URL | Request, init?: RequestInit) => {
				const path = new URL(String(input)).pathname;
				timeline.push(`${init?.method ?? 'GET'} ${path}`);
				if (path === PAYMENT_INTENT_SEARCH_PATH) {
					return Response.json({
						object: 'search_result',
						data: Array.from({ length: searchHits }, pendingIntent),
						has_more: false,
					});
				}
				if (rejectCharge && path === PAYMENT_INTENTS_PATH) {
					return Response.json(
						{
							error: {
								type: 'invalid_request_error',
								code: 'resource_missing',
								param: 'payment_method',
								message: "No such PaymentMethod: 'pm_fixture'",
							},
						},
						{ status: BAD_REQUEST }
					);
				}
				return Response.json({
					id:
						path === PAYMENT_INTENTS_PATH
							? NEW_PAYMENT_INTENT
							: PENDING_PAYMENT_INTENT,
					object: 'payment_intent',
					status: 'succeeded',
					metadata: {},
				});
			}
		),
	});
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'fork', () => manager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'execute', async (sql: string) =>
		sql.includes(CANDIDATE_MARKER)
			? [{ organizationId: ORGANIZATION_ID, thresholdCents: AMOUNT_CENTS }]
			: [{ now: NOW, balance: '0', total: '0' }]
	);
	const policy = Object.assign(new AutoTopUpPolicy(), {
		organizationId: ORGANIZATION_ID,
		enabled: true,
		thresholdCents: AMOUNT_CENTS,
		amountCents: AMOUNT_CENTS,
		paymentMethodId: PAYMENT_METHOD_ID,
	});
	mock.method(manager, 'findOne', async (entity: unknown) =>
		entity === TopUp ? pending : policy
	);
	mock.method(manager, 'findOneOrFail', async (entity: unknown) =>
		entity === PaymentMethod
			? Object.assign(new PaymentMethod(), {
					id: PAYMENT_METHOD_ID,
					stripePaymentMethodId: 'pm_fixture',
				})
			: Object.assign(new PaymentAccount(), {
					organizationId: ORGANIZATION_ID,
					stripeAccountId: 'acct_fixture',
				})
	);
	mock.method(manager, 'persist', () => manager);
	mock.method(
		manager,
		'nativeUpdate',
		async (entity: unknown, _where: unknown, changes: object) => {
			if (entity === TopUp) {
				timeline.push(`update top-up ${Object.keys(changes).join(',')}`);
			}
			return 1;
		}
	);
	const payments = fakeInstance(StripePaymentEventService);
	const settled = mock.method(
		payments,
		'paymentIntentSucceeded',
		async () => {}
	);
	const paymentMethods = fakeInstance(PaymentMethodService);
	const detached = mock.method(paymentMethods, 'markDetached', async () => {});
	const service = new AutoTopUpChargeService(
		manager,
		stripe,
		fakeSettings(),
		fakeInstance(AutoTopUpTaxService),
		payments,
		paymentMethods
	);
	return { service, timeline, settled, detached };
}

describe('AutoTopUpChargeService.runDue', () => {
	it('settles a pending automatic top-up from Stripe instead of charging again', async () => {
		const pending = Object.assign(new TopUp(), {
			id: '7a000000-0000-4000-8000-000000000007',
			organizationId: ORGANIZATION_ID,
			kind: TopUpKind.AUTO,
			amountCents: AMOUNT_CENTS,
			stripePaymentIntentId: PENDING_PAYMENT_INTENT,
			createdAt: NOW,
		});
		const { service, timeline, settled } = harness(pending);

		await service.runDue();

		assert.deepEqual(timeline, [
			`GET ${PAYMENT_INTENTS_PATH}/${PENDING_PAYMENT_INTENT}`,
		]);
		assert.equal(settled.mock.callCount(), 1);
	});

	it('stores the tax on the top-up before it creates the charge', async () => {
		const { service, timeline } = harness(null);

		await service.runDue();

		assert.deepEqual(timeline, [
			'update top-up taxCents',
			`POST ${PAYMENT_INTENTS_PATH}`,
			'update top-up stripePaymentIntentId',
		]);
	});
});

describe('AutoTopUpChargeService resumed attempts', () => {
	function interrupted(): TopUp {
		return Object.assign(new TopUp(), {
			id: '7a000000-0000-4000-8000-000000000008',
			organizationId: ORGANIZATION_ID,
			kind: TopUpKind.AUTO,
			amountCents: AMOUNT_CENTS,
			paymentMethodId: PAYMENT_METHOD_ID,
			createdAt: NOW,
		});
	}

	it('settles the charge an interrupted attempt already created', async () => {
		const { service, timeline, settled } = harness(interrupted(), {
			searchHits: 1,
		});

		await service.runDue();

		assert.deepEqual(timeline, [`GET ${PAYMENT_INTENT_SEARCH_PATH}`]);
		assert.equal(settled.mock.callCount(), 1);
	});

	it('charges again with the same request only when Stripe has no charge', async () => {
		const { service, timeline } = harness(interrupted());

		await service.runDue();

		assert.deepEqual(timeline, [
			`GET ${PAYMENT_INTENT_SEARCH_PATH}`,
			'update top-up taxCents',
			`POST ${PAYMENT_INTENTS_PATH}`,
			'update top-up stripePaymentIntentId',
		]);
	});
});

describe('AutoTopUpChargeService failures', () => {
	it('detaches a card Stripe no longer has and fails the top-up', async () => {
		const { service, timeline, detached } = harness(null, {
			rejectCharge: true,
		});

		await service.runDue();

		assert.deepEqual(detached.mock.calls[0]?.arguments, ['pm_fixture']);
		assert.equal(timeline.at(-1), 'update top-up state,failureCode');
	});
});
