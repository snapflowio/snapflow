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
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { Organization } from '../../organization/entities/organization.entity';
import { fakeSettings } from '../../settings/testing/settings.fake';
import { TopUpFailureCode } from '../constants/payments.constants';
import {
	STRIPE_API_VERSION,
	StripeIdempotencyPrefix,
} from '../constants/stripe.constants';
import { PaymentAccount } from '../entities/payment-account.entity';
import { TopUp } from '../entities/top-up.entity';
import { TopUpKind } from '../enums/top-up-kind.enum';
import { TopUpState } from '../enums/top-up-state.enum';
import { PaymentAccountService } from './payment-account.service';
import { PaymentVelocityService } from './payment-velocity.service';
import { StripePaymentEventService } from './stripe-event/stripe-payment-event.service';
import { TopUpService } from './top-up.service';
import { TopUpSettlementService } from './top-up-settlement.service';

const ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const PENDING_TOP_UP_ID = '7a000000-0000-4000-8000-000000000007';
const CONNECTED_ACCOUNT = 'acct_fixture';
const CHECKOUT_SESSION_ID = 'cs_test_fixture';
const CHECKOUT_CLIENT_SECRET = 'cs_test_fixture_secret_fixture';
const PAYMENT_INTENT_ID = 'pi_fixture';
const CHECKOUT_SESSIONS_PATH = '/v1/checkout/sessions';
const CHECKOUT_SESSION_PATH = `${CHECKOUT_SESSIONS_PATH}/${CHECKOUT_SESSION_ID}`;
const DASHBOARD_URL = 'https://dashboard.snapflow.test';
const AMOUNT_CENTS = 2_500;
const UPDATED_AMOUNT_CENTS = 5_000;
const OUT_OF_RANGE_CENTS = 500;
const IDEMPOTENCY_HEADER = 'idempotency-key';
const NOT_FOUND = 404;
const OWNER = {
	organizationId: ORGANIZATION_ID,
	contactEmail: 'owner@snapflow.test',
};

interface RecordedRequest {
	method: string;
	path: string;
	form: URLSearchParams;
	idempotencyKey: string | null;
}

interface HarnessOptions {
	customerAccount?: () => Promise<PaymentAccount>;
	pending?: TopUp | null;
	sessionStatus?: Stripe.Checkout.Session.Status;
	sessionMissing?: boolean;
}

function prototypeOf<Service extends object>(
	service: abstract new (...args: never[]) => Service
): Service {
	return Object.create(service.prototype);
}

function recordingStripe(
	requests: RecordedRequest[],
	sessionStatus: Stripe.Checkout.Session.Status,
	sessionMissing: boolean
): Stripe {
	const stripeFetch = async (
		input: string | URL | Request,
		init?: RequestInit
	): Promise<Response> => {
		const headers = new Headers(init?.headers);
		requests.push({
			method: init?.method ?? 'GET',
			path: new URL(String(input)).pathname,
			form: new URLSearchParams(String(init?.body ?? '')),
			idempotencyKey: headers.get(IDEMPOTENCY_HEADER),
		});
		if (sessionMissing && init?.method === 'GET') {
			return Response.json(
				{
					error: {
						type: 'invalid_request_error',
						code: 'resource_missing',
						message: `No such checkout.session: ${CHECKOUT_SESSION_ID}`,
					},
				},
				{ status: NOT_FOUND }
			);
		}
		return Response.json({
			id: CHECKOUT_SESSION_ID,
			object: 'checkout.session',
			client_secret: CHECKOUT_CLIENT_SECRET,
			status: sessionStatus,
			payment_intent:
				sessionStatus === 'complete'
					? {
							id: PAYMENT_INTENT_ID,
							object: 'payment_intent',
							status: 'succeeded',
						}
					: null,
		});
	};
	return new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		httpClient: Stripe.createFetchHttpClient(stripeFetch),
	});
}

function pendingTopUp(): TopUp {
	return Object.assign(new TopUp(), {
		id: PENDING_TOP_UP_ID,
		organizationId: ORGANIZATION_ID,
		kind: TopUpKind.MANUAL,
		amountCents: AMOUNT_CENTS,
		stripeCheckoutSessionId: CHECKOUT_SESSION_ID,
	});
}

function requestLines(requests: RecordedRequest[]): string[] {
	return requests.map(({ method, path }) => `${method} ${path}`);
}

function harness(
	requests: RecordedRequest[],
	{
		customerAccount = async () =>
			Object.assign(new PaymentAccount(), {
				organizationId: ORGANIZATION_ID,
				stripeAccountId: CONNECTED_ACCOUNT,
			}),
		pending = null,
		sessionStatus = 'open',
		sessionMissing = false,
	}: HarnessOptions = {}
) {
	const manager = prototypeOf(EntityManager);
	mock.method(manager, 'fork', () => manager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'execute', async () => [{ now: new Date(0) }]);
	const organization = Object.assign(new Organization(), {
		id: ORGANIZATION_ID,
		suspended: false,
	});
	mock.method(manager, 'findOneOrFail', async () => pending);
	mock.method(manager, 'findOne', async (entity: unknown) =>
		entity === Organization ? organization : pending
	);
	mock.method(manager, 'persist', () => manager);
	const updates = mock.method(manager, 'nativeUpdate', async () => 1);

	const accounts = Object.assign(prototypeOf(PaymentAccountService), {
		ensureCustomer: customerAccount,
	});
	const velocity = Object.assign(prototypeOf(PaymentVelocityService), {
		assertTopUpAllowed: async () => undefined,
	});
	const config = Object.assign(prototypeOf(TypedConfigService), {
		getOrThrow: () => DASHBOARD_URL,
	});
	const payments = prototypeOf(StripePaymentEventService);
	const credited: string[] = [];
	const succeeded = mock.method(
		payments,
		'paymentIntentSucceeded',
		async (intent: Stripe.PaymentIntent) => {
			credited.push(intent.id);
		}
	);
	mock.method(payments, 'checkoutSessionCompleted', async () => undefined);
	const expired = mock.method(
		payments,
		'checkoutSessionExpired',
		async () => undefined
	);

	const stripe = recordingStripe(requests, sessionStatus, sessionMissing);
	return {
		service: new TopUpService(
			manager,
			stripe,
			fakeSettings(),
			config,
			accounts,
			velocity,
			new TopUpSettlementService(manager, stripe, payments)
		),
		updates,
		credited,
		succeeded,
		expired,
	};
}

describe('TopUpService.create', () => {
	it('opens an Elements Checkout session for the top-up', async () => {
		const requests: RecordedRequest[] = [];
		const { service, updates } = harness(requests);

		const session = await service.create(OWNER, { amountCents: AMOUNT_CENTS });

		assert.equal(session.checkoutClientSecret, CHECKOUT_CLIENT_SECRET);
		const [request] = requests;
		assert.ok(request);
		assert.equal(request.path, CHECKOUT_SESSIONS_PATH);
		assert.equal(request.form.get('ui_mode'), 'elements');
		assert.equal(request.form.get('allowed_payment_method_types[0]'), 'card');
		assert.equal(request.form.has('allowed_payment_method_types[1]'), false);
		assert.equal(request.form.get('wallet_options[link][display]'), 'never');
		assert.equal(
			request.form.has('branding_settings[background_color]'),
			false
		);
		assert.equal(request.form.get('customer_account'), CONNECTED_ACCOUNT);
		assert.equal(
			request.form.get('saved_payment_method_options[payment_method_save]'),
			'enabled'
		);
		assert.equal(
			request.form.has('payment_intent_data[setup_future_usage]'),
			false
		);
		assert.equal(
			request.form.get('line_items[0][price_data][unit_amount]'),
			String(AMOUNT_CENTS)
		);
		assert.equal(
			request.form.get('return_url'),
			`${DASHBOARD_URL}/billing?topUpId=${session.topUpId}`
		);
		assert.equal(
			request.idempotencyKey,
			`${StripeIdempotencyPrefix.TOP_UP}:${session.topUpId}`
		);
		assert.deepEqual(updates.mock.calls[0]?.arguments.slice(1), [
			{ id: session.topUpId },
			{ stripeCheckoutSessionId: CHECKOUT_SESSION_ID },
		]);
	});

	it('fails the top-up when the customer account cannot be prepared', async () => {
		const requests: RecordedRequest[] = [];
		const rejection = new Error('account setup failed');
		const { service, updates } = harness(requests, {
			customerAccount: async () => {
				throw rejection;
			},
		});

		await assert.rejects(
			service.create(OWNER, { amountCents: AMOUNT_CENTS }),
			rejection
		);

		assert.equal(requests.length, 0);
		const [update] = updates.mock.calls;
		assert.ok(update);
		assert.deepEqual(update.arguments[2], {
			state: TopUpState.FAILED,
			failureCode: TopUpFailureCode.PAYMENT_ERROR,
		});
	});

	it('resumes the open Checkout session of a pending top-up', async () => {
		const requests: RecordedRequest[] = [];
		const pending = pendingTopUp();
		const { service } = harness(requests, { pending });

		const session = await service.create(OWNER, {
			amountCents: UPDATED_AMOUNT_CENTS,
		});

		assert.deepEqual(session, {
			topUpId: PENDING_TOP_UP_ID,
			checkoutClientSecret: CHECKOUT_CLIENT_SECRET,
		});
		assert.deepEqual(requestLines(requests), [
			`GET ${CHECKOUT_SESSION_PATH}`,
			`POST ${CHECKOUT_SESSION_PATH}`,
		]);
		assert.equal(pending.amountCents, UPDATED_AMOUNT_CENTS);
	});

	it('opens a new session when the pending one is no longer open', async () => {
		const requests: RecordedRequest[] = [];
		const { service } = harness(requests, {
			pending: pendingTopUp(),
			sessionStatus: 'expired',
		});

		const session = await service.create(OWNER, { amountCents: AMOUNT_CENTS });

		assert.notEqual(session.topUpId, PENDING_TOP_UP_ID);
		assert.deepEqual(requestLines(requests), [
			`GET ${CHECKOUT_SESSION_PATH}`,
			`POST ${CHECKOUT_SESSIONS_PATH}`,
		]);
	});
});

describe('TopUpService.create with a missing session', () => {
	it('expires a pending top-up whose session Stripe lost and opens a new one', async () => {
		const requests: RecordedRequest[] = [];
		const { service, updates } = harness(requests, {
			pending: pendingTopUp(),
			sessionMissing: true,
		});

		const session = await service.create(OWNER, { amountCents: AMOUNT_CENTS });

		assert.notEqual(session.topUpId, PENDING_TOP_UP_ID);
		assert.deepEqual(requestLines(requests), [
			`GET ${CHECKOUT_SESSION_PATH}`,
			`POST ${CHECKOUT_SESSIONS_PATH}`,
		]);
		assert.deepEqual(updates.mock.calls[0]?.arguments.slice(1), [
			{
				id: PENDING_TOP_UP_ID,
				stripeCheckoutSessionId: CHECKOUT_SESSION_ID,
				state: TopUpState.CREATED,
			},
			{ state: TopUpState.EXPIRED },
		]);
	});
});

describe('TopUpService.get', () => {
	it('credits a paid Checkout session without waiting for the webhook', async () => {
		const requests: RecordedRequest[] = [];
		const { service, credited } = harness(requests, {
			pending: pendingTopUp(),
			sessionStatus: 'complete',
		});

		await service.get(ORGANIZATION_ID, PENDING_TOP_UP_ID);

		assert.deepEqual(credited, [PAYMENT_INTENT_ID]);
	});

	it('expires a top-up whose Checkout session expired', async () => {
		const requests: RecordedRequest[] = [];
		const { service, succeeded, expired } = harness(requests, {
			pending: pendingTopUp(),
			sessionStatus: 'expired',
		});

		await service.get(ORGANIZATION_ID, PENDING_TOP_UP_ID);

		assert.equal(expired.mock.callCount(), 1);
		assert.equal(succeeded.mock.callCount(), 0);
	});

	it('leaves an open Checkout session alone', async () => {
		const requests: RecordedRequest[] = [];
		const { service, succeeded, expired } = harness(requests, {
			pending: pendingTopUp(),
		});

		await service.get(ORGANIZATION_ID, PENDING_TOP_UP_ID);

		assert.equal(succeeded.mock.callCount() + expired.mock.callCount(), 0);
	});
});

describe('TopUpService.updateAmount', () => {
	it('replaces the line item of the open Checkout session', async () => {
		const requests: RecordedRequest[] = [];
		const { service } = harness(requests, { pending: pendingTopUp() });

		const topUp = await service.updateAmount(
			ORGANIZATION_ID,
			PENDING_TOP_UP_ID,
			{ amountCents: UPDATED_AMOUNT_CENTS }
		);

		assert.equal(topUp.amountCents, UPDATED_AMOUNT_CENTS);
		const update = requests.find(({ method }) => method === 'POST');
		assert.ok(update);
		assert.equal(update.path, CHECKOUT_SESSION_PATH);
		assert.equal(
			update.form.get('line_items[0][price_data][unit_amount]'),
			String(UPDATED_AMOUNT_CENTS)
		);
		assert.equal(update.form.has('line_items[0][id]'), false);
	});

	it('skips Stripe when the amount is unchanged', async () => {
		const requests: RecordedRequest[] = [];
		const { service } = harness(requests, { pending: pendingTopUp() });

		await service.updateAmount(ORGANIZATION_ID, PENDING_TOP_UP_ID, {
			amountCents: AMOUNT_CENTS,
		});

		assert.deepEqual(requestLines(requests), [`GET ${CHECKOUT_SESSION_PATH}`]);
	});

	it('rejects amounts outside the platform limits', async () => {
		const requests: RecordedRequest[] = [];
		const { service } = harness(requests, { pending: pendingTopUp() });

		await assert.rejects(
			service.updateAmount(ORGANIZATION_ID, PENDING_TOP_UP_ID, {
				amountCents: OUT_OF_RANGE_CENTS,
			}),
			BadRequestException
		);
		assert.equal(requests.length, 0);
	});

	it('conflicts once the Checkout session is no longer open', async () => {
		const requests: RecordedRequest[] = [];
		const { service } = harness(requests, {
			pending: pendingTopUp(),
			sessionStatus: 'complete',
		});

		await assert.rejects(
			service.updateAmount(ORGANIZATION_ID, PENDING_TOP_UP_ID, {
				amountCents: UPDATED_AMOUNT_CENTS,
			}),
			ConflictException
		);
		assert.deepEqual(requestLines(requests), [`GET ${CHECKOUT_SESSION_PATH}`]);
	});

	it('conflicts when the top-up already left the created state', async () => {
		const requests: RecordedRequest[] = [];
		const { service } = harness(requests, {
			pending: Object.assign(pendingTopUp(), {
				state: TopUpState.SUCCEEDED,
			}),
		});

		await assert.rejects(
			service.updateAmount(ORGANIZATION_ID, PENDING_TOP_UP_ID, {
				amountCents: UPDATED_AMOUNT_CENTS,
			}),
			ConflictException
		);
		assert.equal(requests.length, 0);
	});

	it('hides top-ups the organization does not own', async () => {
		const requests: RecordedRequest[] = [];
		const { service } = harness(requests);

		await assert.rejects(
			service.updateAmount(ORGANIZATION_ID, PENDING_TOP_UP_ID, {
				amountCents: UPDATED_AMOUNT_CENTS,
			}),
			NotFoundException
		);
		assert.equal(requests.length, 0);
	});
});
