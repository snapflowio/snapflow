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
import { STRIPE_API_VERSION } from '../constants/stripe.constants';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodService } from './payment-method.service';

const ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const PAYMENT_METHOD_ID = '7b000000-0000-4000-8000-000000000001';
const CUSTOMER_ACCOUNT = 'acct_customer';
const STRIPE_PAYMENT_METHOD = 'pm_fixture';
const CHARGED_AT = new Date('2026-10-21T12:00:00.000Z');
const NOW = new Date('2026-10-22T12:00:00.000Z');

function card(
	customerAccount: string | null,
	allowRedisplay: Stripe.PaymentMethod.AllowRedisplay
) {
	return {
		id: STRIPE_PAYMENT_METHOD,
		object: 'payment_method',
		customer: null,
		customer_account: customerAccount,
		allow_redisplay: allowRedisplay,
		card: {
			brand: 'visa',
			last4: '4242',
			exp_month: 12,
			exp_year: 2030,
			fingerprint: 'fp_fixture',
		},
	};
}

function harness(
	remote: ReturnType<typeof card>,
	stored: PaymentMethod | null
) {
	const requests: string[] = [];
	const stripe = new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		httpClient: Stripe.createFetchHttpClient(
			async (input: string | URL | Request, init?: RequestInit) => {
				requests.push(`${init?.method} ${new URL(String(input)).pathname}`);
				return Response.json(remote);
			}
		),
	});
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'fork', () => manager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'execute', async () => [{ now: NOW }]);
	mock.method(manager, 'findOne', async () => stored);
	mock.method(manager, 'persist', () => manager);
	mock.method(manager, 'nativeUpdate', async () => 1);
	return {
		manager,
		stripe,
		requests,
		service: new PaymentMethodService(manager, stripe),
	};
}

async function record(
	remote: ReturnType<typeof card>
): Promise<PaymentMethod | null> {
	const { manager, stripe, service } = harness(remote, null);
	const charged = await stripe.paymentMethods.retrieve(STRIPE_PAYMENT_METHOD);
	return service.record(
		manager,
		ORGANIZATION_ID,
		CUSTOMER_ACCOUNT,
		charged,
		CHARGED_AT
	);
}

describe('PaymentMethodService.record', () => {
	it('offers a card the customer saved to its account for reuse', async () => {
		const method = await record(card(CUSTOMER_ACCOUNT, 'always'));

		assert.equal(method?.detachedAt, null);
		assert.equal(method?.firstChargedAt, CHARGED_AT);
	});

	it('records a card that was not saved without offering it for reuse', async () => {
		assert.equal(
			(await record(card(null, 'unspecified')))?.detachedAt,
			CHARGED_AT
		);
		assert.equal(
			(await record(card('acct_other', 'always')))?.detachedAt,
			CHARGED_AT
		);
		assert.equal(
			(await record(card(CUSTOMER_ACCOUNT, 'limited')))?.detachedAt,
			CHARGED_AT
		);
	});
});

describe('PaymentMethodService.delete', () => {
	function storedMethod(): PaymentMethod {
		return Object.assign(new PaymentMethod(), {
			id: PAYMENT_METHOD_ID,
			organizationId: ORGANIZATION_ID,
			stripePaymentMethodId: STRIPE_PAYMENT_METHOD,
		});
	}

	it('detaches a card that is still attached in Stripe', async () => {
		const method = storedMethod();
		const { service, requests } = harness(
			card(CUSTOMER_ACCOUNT, 'always'),
			method
		);

		await service.delete(ORGANIZATION_ID, PAYMENT_METHOD_ID);

		assert.deepEqual(requests, [
			`GET /v1/payment_methods/${STRIPE_PAYMENT_METHOD}`,
			`POST /v1/payment_methods/${STRIPE_PAYMENT_METHOD}/detach`,
		]);
		assert.equal(method.detachedAt, NOW);
	});

	it('only forgets a card Stripe no longer has attached', async () => {
		const method = storedMethod();
		const { service, requests } = harness(card(null, 'always'), method);

		await service.delete(ORGANIZATION_ID, PAYMENT_METHOD_ID);

		assert.deepEqual(requests, [
			`GET /v1/payment_methods/${STRIPE_PAYMENT_METHOD}`,
		]);
		assert.equal(method.detachedAt, NOW);
	});
});
