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
import { ConflictException } from '@nestjs/common';
import Stripe from 'stripe';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import { fakeSettings } from '../../../settings/platform/testing/settings.fake';
import {
	PaymentsErrorCode,
	PayoutsBlockedReason,
} from '../constants/payments.constants';
import {
	HOST_BUSINESS_PROFILE,
	STRIPE_API_VERSION,
	STRIPE_CURRENCY,
	STRIPE_DASHBOARD,
	STRIPE_RESPONSIBLE_PARTY,
	StripeAccountConfiguration,
	StripeIdempotencyPrefix,
} from '../constants/stripe.constants';
import { PaymentAccount } from '../entities/payment-account.entity';
import {
	PaymentAccountRequirementsStatus,
	PaymentAccountTransfersStatus,
} from '../enums/payment-account-status.enum';
import { PayoutAccountType } from '../enums/payout-account-type.enum';
import { PaymentAccountService } from './payment-account.service';
import { PaymentMethodService } from './payment-method.service';

const ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const CONNECTED_ACCOUNT = 'acct_fixture';
const CONCURRENT_ACCOUNT = 'acct_concurrent';
const MISSING_ACCOUNT = 'acct_missing';
const ACCOUNTS_PATH = '/v2/core/accounts';
const OWNER = {
	organizationId: ORGANIZATION_ID,
	contactEmail: 'owner@snapflow.test',
};

interface RecordedRequest {
	method: string;
	path: string;
	body: string;
	idempotencyKey: string | null;
}

const BALANCE_SETTINGS_PATH = '/v1/balance_settings';
const V1_ACCOUNT_PATH = `/v1/accounts/${CONNECTED_ACCOUNT}`;
const IDEMPOTENCY_HEADER = 'idempotency-key';
const POST = 'POST';
const MONDAY_PAYOUTS = {
	object: 'balance_settings',
	payments: {
		debit_negative_balances: true,
		payouts: {
			schedule: { interval: 'weekly', weekly_payout_days: ['monday'] },
		},
	},
};
const FRIDAY_PAYOUTS = {
	...MONDAY_PAYOUTS,
	payments: {
		...MONDAY_PAYOUTS.payments,
		payouts: {
			schedule: { interval: 'weekly', weekly_payout_days: ['friday'] },
		},
	},
};
const HOST_ACCOUNT = {
	id: CONNECTED_ACCOUNT,
	object: 'account',
	business_profile: HOST_BUSINESS_PROFILE,
};

function prototypeOf<Service extends object>(
	service: abstract new (...args: never[]) => Service
): Service {
	return Object.create(service.prototype);
}

function remoteAccount(configurations: readonly string[]) {
	return {
		id: CONNECTED_ACCOUNT,
		object: 'v2.core.account',
		applied_configurations: configurations,
		identity: { country: 'us' },
		requirements: { summary: { minimum_deadline: null } },
	};
}

interface RemoteState {
	configurations: readonly string[];
	account?: object;
	balanceSettings?: object;
}

function recordingStripe(
	requests: RecordedRequest[],
	remote: RemoteState
): Stripe {
	const stripeFetch = async (
		input: string | URL | Request,
		init?: RequestInit
	): Promise<Response> => {
		const path = new URL(String(input)).pathname;
		requests.push({
			method: init?.method ?? 'GET',
			path,
			body: String(init?.body ?? ''),
			idempotencyKey: new Headers(init?.headers).get(IDEMPOTENCY_HEADER),
		});
		if (path === BALANCE_SETTINGS_PATH) {
			return Response.json(remote.balanceSettings ?? FRIDAY_PAYOUTS);
		}
		if (path === V1_ACCOUNT_PATH) {
			return Response.json(remote.account ?? { id: CONNECTED_ACCOUNT });
		}
		return Response.json(remoteAccount(remote.configurations));
	};
	return new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		httpClient: Stripe.createFetchHttpClient(stripeFetch),
	});
}

function harness(
	existing: PaymentAccount | null,
	configurations: readonly string[],
	storedAccountId = CONNECTED_ACCOUNT,
	remote: Omit<RemoteState, 'configurations'> = {}
) {
	const requests: RecordedRequest[] = [];
	const stored =
		existing ??
		Object.assign(new PaymentAccount(), {
			organizationId: ORGANIZATION_ID,
			stripeAccountId: storedAccountId,
		});
	const manager = prototypeOf(EntityManager);
	mock.method(manager, 'fork', () => manager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	const organization = Object.assign(new Organization(), {
		id: ORGANIZATION_ID,
		name: 'Org',
	});
	mock.method(manager, 'findOne', async (entity: unknown) =>
		entity === Organization ? organization : existing
	);
	mock.method(manager, 'upsert', async () => stored);
	mock.method(manager, 'findOneOrFail', async () => stored);
	const paymentMethods = fakeInstance(PaymentMethodService);
	const detachedAll = mock.method(
		paymentMethods,
		'markAllDetached',
		async () => {}
	);
	return {
		requests,
		detachedAll,
		service: new PaymentAccountService(
			manager,
			recordingStripe(requests, { configurations, ...remote }),
			fakeSettings(),
			paymentMethods
		),
	};
}

describe('PaymentAccountService account configurations', () => {
	it('creates a customer-only account without recipient-only fields', async () => {
		const { service, requests } = harness(null, [
			StripeAccountConfiguration.CUSTOMER,
		]);

		const account = await service.ensureCustomer(OWNER);

		assert.equal(account.customerConfigured, true);
		const [request] = requests;
		assert.ok(request);
		assert.equal(request.path, ACCOUNTS_PATH);
		const body = JSON.parse(request.body);
		assert.deepEqual(body.configuration, { customer: {} });
		assert.equal('dashboard' in body, false);
		assert.equal('defaults' in body, false);
		assert.equal('identity' in body, false);
	});

	it('refreshes a payout account from Stripe until payouts are enabled', async () => {
		const pending = Object.assign(new PaymentAccount(), {
			organizationId: ORGANIZATION_ID,
			stripeAccountId: CONNECTED_ACCOUNT,
			recipientRequested: true,
			transfersStatus: PaymentAccountTransfersStatus.PENDING,
			requirementsStatus: PaymentAccountRequirementsStatus.NONE,
			payoutsBlockedReason: null,
		});
		const { service, requests } = harness(pending, [
			StripeAccountConfiguration.RECIPIENT,
		]);

		await service.currentPayoutAccount(ORGANIZATION_ID);

		assert.deepEqual(
			requests.map((request) => request.path),
			[`${ACCOUNTS_PATH}/${CONNECTED_ACCOUNT}`]
		);
	});

	it('serves an enabled payout account without asking Stripe', async () => {
		const enabled = Object.assign(new PaymentAccount(), {
			organizationId: ORGANIZATION_ID,
			stripeAccountId: CONNECTED_ACCOUNT,
			recipientRequested: true,
			transfersStatus: PaymentAccountTransfersStatus.ACTIVE,
			requirementsStatus: PaymentAccountRequirementsStatus.NONE,
			payoutsBlockedReason: null,
		});
		const { service, requests } = harness(enabled, [
			StripeAccountConfiguration.RECIPIENT,
		]);

		await service.currentPayoutAccount(ORGANIZATION_ID);

		assert.equal(requests.length, 0);
	});

	it('closes the account it created when a concurrent request stored another one', async () => {
		const { service, requests } = harness(
			null,
			[StripeAccountConfiguration.CUSTOMER],
			CONCURRENT_ACCOUNT
		);

		await service.ensureCustomer(OWNER);

		assert.deepEqual(
			requests.map((request) => request.path),
			[
				ACCOUNTS_PATH,
				`${ACCOUNTS_PATH}/${CONNECTED_ACCOUNT}/close`,
				`${ACCOUNTS_PATH}/${CONCURRENT_ACCOUNT}`,
			]
		);
	});

	it('gives the Express dashboard to a customer account that becomes a recipient', async () => {
		const existing = Object.assign(new PaymentAccount(), {
			organizationId: ORGANIZATION_ID,
			stripeAccountId: CONNECTED_ACCOUNT,
			customerConfigured: true,
			recipientRequested: false,
			country: null,
		});
		const { service, requests } = harness(existing, [
			StripeAccountConfiguration.CUSTOMER,
			StripeAccountConfiguration.RECIPIENT,
		]);

		const account = await service.ensureRecipient(OWNER, {
			country: 'US',
			type: PayoutAccountType.INDIVIDUAL,
		});

		assert.equal(account.recipientRequested, true);
		const [update] = requests;
		assert.ok(update);
		assert.equal(update.path, `${ACCOUNTS_PATH}/${CONNECTED_ACCOUNT}`);
		const body = JSON.parse(update.body);
		assert.equal(body.dashboard, STRIPE_DASHBOARD);
		assert.deepEqual(body.identity, {
			country: 'US',
			entity_type: PayoutAccountType.INDIVIDUAL,
			individual: { email: OWNER.contactEmail },
		});
		assert.deepEqual(body.defaults, {
			currency: STRIPE_CURRENCY,
			responsibilities: {
				fees_collector: STRIPE_RESPONSIBLE_PARTY,
				losses_collector: STRIPE_RESPONSIBLE_PARTY,
			},
		});
		assert.equal(
			body.configuration.recipient.capabilities.stripe_balance.stripe_transfers
				.requested,
			true
		);
		const profile = requests.find(
			(request) => request.method === POST && request.path === V1_ACCOUNT_PATH
		);
		assert.ok(profile);
		const fields = new URLSearchParams(profile.body);
		assert.equal(
			fields.get('business_profile[mcc]'),
			HOST_BUSINESS_PROFILE.mcc
		);
		assert.equal(
			fields.get('business_profile[product_description]'),
			HOST_BUSINESS_PROFILE.product_description
		);
	});

	it('leaves an existing recipient alone when Stripe already matches', async () => {
		const existing = Object.assign(new PaymentAccount(), {
			organizationId: ORGANIZATION_ID,
			stripeAccountId: CONNECTED_ACCOUNT,
			recipientRequested: true,
		});
		const { service, requests } = harness(
			existing,
			[StripeAccountConfiguration.RECIPIENT],
			CONNECTED_ACCOUNT,
			{ account: HOST_ACCOUNT, balanceSettings: MONDAY_PAYOUTS }
		);

		await service.ensureRecipient(OWNER, {
			country: 'US',
			type: PayoutAccountType.INDIVIDUAL,
		});

		assert.deepEqual(
			requests.filter((request) => request.method === POST),
			[]
		);
	});

	it('moves the payout schedule of an existing recipient to the payout weekday', async () => {
		const existing = Object.assign(new PaymentAccount(), {
			organizationId: ORGANIZATION_ID,
			stripeAccountId: CONNECTED_ACCOUNT,
			recipientRequested: true,
		});
		const { service, requests } = harness(
			existing,
			[StripeAccountConfiguration.RECIPIENT],
			CONNECTED_ACCOUNT,
			{ account: HOST_ACCOUNT, balanceSettings: FRIDAY_PAYOUTS }
		);

		await service.ensureRecipient(OWNER, {
			country: 'US',
			type: PayoutAccountType.INDIVIDUAL,
		});

		const updates = requests.filter((request) => request.method === POST);
		assert.deepEqual(
			updates.map((request) => request.path),
			[BALANCE_SETTINGS_PATH]
		);
		const [update] = updates;
		assert.equal(
			new URLSearchParams(update?.body).get(
				'payments[payouts][schedule][weekly_payout_days][0]'
			),
			'monday'
		);
		assert.match(
			update?.idempotencyKey ?? '',
			new RegExp(
				`^${StripeIdempotencyPrefix.BALANCE_SETTINGS}:${ORGANIZATION_ID}:[0-9a-f]{64}$`
			)
		);
	});
});

function missingCustomerAccount(): Stripe.errors.StripeInvalidRequestError {
	return new Stripe.errors.StripeInvalidRequestError({
		message: `No such customer: '${MISSING_ACCOUNT}'`,
		code: 'resource_missing',
		param: 'customer_account',
	});
}

describe('PaymentAccountService.withCustomer', () => {
	it('replaces a customer account Stripe no longer has and retries once', async () => {
		const existing = Object.assign(new PaymentAccount(), {
			organizationId: ORGANIZATION_ID,
			stripeAccountId: MISSING_ACCOUNT,
			customerConfigured: true,
			recipientRequested: false,
		});
		const { service, requests, detachedAll } = harness(existing, [
			StripeAccountConfiguration.CUSTOMER,
		]);
		const used: string[] = [];

		const result = await service.withCustomer(OWNER, async (account) => {
			used.push(account.stripeAccountId);
			if (account.stripeAccountId === MISSING_ACCOUNT) {
				throw missingCustomerAccount();
			}
			return account.stripeAccountId;
		});

		assert.equal(result, CONNECTED_ACCOUNT);
		assert.deepEqual(used, [MISSING_ACCOUNT, CONNECTED_ACCOUNT]);
		assert.deepEqual(
			requests.map((request) => `${request.method} ${request.path}`),
			[`${POST} ${ACCOUNTS_PATH}`]
		);
		assert.match(
			requests[0]?.idempotencyKey ?? '',
			new RegExp(
				`^${StripeIdempotencyPrefix.ACCOUNT}:${MISSING_ACCOUNT}:${StripeAccountConfiguration.CUSTOMER}:`
			)
		);
		assert.equal(existing.stripeAccountId, CONNECTED_ACCOUNT);
		assert.equal(detachedAll.mock.callCount(), 1);
	});

	it('blocks the payouts of a missing recipient account instead of replacing it', async () => {
		const existing = Object.assign(new PaymentAccount(), {
			organizationId: ORGANIZATION_ID,
			stripeAccountId: MISSING_ACCOUNT,
			customerConfigured: true,
			recipientRequested: true,
			payoutsBlockedReason: null,
		});
		const { service, requests } = harness(existing, [
			StripeAccountConfiguration.CUSTOMER,
			StripeAccountConfiguration.RECIPIENT,
		]);

		await assert.rejects(
			service.withCustomer(OWNER, async () => {
				throw missingCustomerAccount();
			}),
			(error: unknown) =>
				error instanceof ConflictException &&
				JSON.stringify(error.getResponse()).includes(
					PaymentsErrorCode.PAYMENT_ACCOUNT_UNAVAILABLE
				)
		);
		assert.equal(requests.length, 0);
		assert.equal(
			existing.payoutsBlockedReason,
			PayoutsBlockedReason.ACCOUNT_CLOSED
		);
	});
});
