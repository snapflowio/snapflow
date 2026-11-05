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
import { RecordingLedger } from '../../billing/usage/testing/recording-ledger.fake';
import { fakeInstance } from '../../common/testing/instance.fake';
import { ISO_WEEKDAY } from '../../settings/constants/settings.constants';
import { fakeSettings } from '../../settings/testing/settings.fake';
import { PayoutsBlockedReason } from '../constants/payments.constants';
import {
	STRIPE_API_VERSION,
	StripeErrorCode,
	StripeMetadataKey,
	StripeRequestParam,
} from '../constants/stripe.constants';
import { PaymentAccount } from '../entities/payment-account.entity';
import { Payout } from '../entities/payout.entity';
import { PayoutBatch } from '../entities/payout-batch.entity';
import { PayoutState } from '../enums/payout-state.enum';
import { PaymentAccountService } from './payment-account.service';
import { PayoutService } from './payout.service';

const FAILING_HOST = '6f000000-0000-4000-8000-000000000001';
const PAID_HOST = '6f000000-0000-4000-8000-000000000002';
const WEDNESDAY = new Date('2026-10-21T12:00:00.000Z');
const CURRENT_WEEK = '2026-W43';
const FRIDAY = 5;
const TRANSFERS_PATH = '/v1/transfers';
const CANDIDATES_MARKER = '"payment_account" account';
const AVAILABLE_MICRO_USD = '50000000';
const TRANSFER_CREATED_SECONDS = 1_792_000_000;
const BAD_REQUEST = 400;

interface Scenario {
	payoutWeekday: number;
	batch: PayoutBatch | null;
}

function harness({ payoutWeekday, batch }: Scenario) {
	const transfers: URLSearchParams[] = [];
	const stripe = new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		httpClient: Stripe.createFetchHttpClient(
			async (input: string | URL | Request, init?: RequestInit) => {
				const form = new URLSearchParams(String(init?.body ?? ''));
				if (new URL(String(input)).pathname === TRANSFERS_PATH) {
					transfers.push(form);
				}
				return Response.json({
					id: 'tr_fixture',
					object: 'transfer',
					created: TRANSFER_CREATED_SECONDS,
					metadata: {
						[StripeMetadataKey.PAYOUT_ID]: form.get(
							`metadata[${StripeMetadataKey.PAYOUT_ID}]`
						),
					},
				});
			}
		),
	});
	const payouts = new Map<string, Payout>();
	const batches: PayoutBatch[] = [];
	let candidatesServed = false;
	let candidateQueries = 0;
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'fork', () => manager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'execute', async (sql: string) => {
		if (!sql.includes(CANDIDATES_MARKER)) {
			return [{ now: WEDNESDAY, balance: AVAILABLE_MICRO_USD }];
		}
		candidateQueries += 1;
		if (candidatesServed) return [];
		candidatesServed = true;
		return [FAILING_HOST, PAID_HOST].map((organizationId) => ({
			organizationId,
			stripeAccountId: `acct_${organizationId}`,
		}));
	});
	mock.method(manager, 'find', async () => []);
	mock.method(
		manager,
		'findOne',
		async (entity: unknown, where: { id?: string }) =>
			entity === PayoutBatch ? batch : (payouts.get(where.id ?? '') ?? null)
	);
	mock.method(
		manager,
		'findOneOrFail',
		async (_entity: unknown, where: { organizationId: string }) => {
			if (where.organizationId === FAILING_HOST) {
				throw new Error('payment account is locked');
			}
			return Object.assign(new PaymentAccount(), {
				organizationId: where.organizationId,
				stripeAccountId: `acct_${where.organizationId}`,
			});
		}
	);
	mock.method(manager, 'persist', (row: unknown) => {
		if (row instanceof Payout) payouts.set(row.id, row);
		if (row instanceof PayoutBatch) batches.push(row);
		return manager;
	});
	const completions = mock.method(manager, 'nativeUpdate', async () => 1);
	const service = new PayoutService(
		manager,
		stripe,
		new RecordingLedger(),
		fakeSettings({ payoutWeekday }),
		fakeInstance(PaymentAccountService)
	);
	return {
		service,
		transfers,
		payouts,
		batches,
		completions,
		candidateQueries: () => candidateQueries,
	};
}

describe('PayoutService.runPayouts', () => {
	it('catches up a missed payout day and pays every host even when one fails', async () => {
		const { service, transfers, payouts, batches, completions } = harness({
			payoutWeekday: ISO_WEEKDAY.MONDAY,
			batch: null,
		});

		await service.runPayouts();

		assert.deepEqual(
			batches.map((batch) => batch.isoWeek),
			[CURRENT_WEEK]
		);
		assert.equal(transfers.length, 1);
		assert.equal(transfers[0]?.get('destination'), `acct_${PAID_HOST}`);
		assert.deepEqual(
			[...payouts.values()].map((payout) => [
				payout.organizationId,
				payout.state,
			]),
			[[PAID_HOST, PayoutState.TRANSFERRED]]
		);
		assert.equal(completions.mock.calls[0]?.arguments[0], PayoutBatch);
	});

	it('waits for the payout weekday and runs a week only once', async () => {
		const early = harness({ payoutWeekday: FRIDAY, batch: null });
		await early.service.runPayouts();
		assert.equal(early.candidateQueries(), 0);

		const completed = Object.assign(new PayoutBatch(), {
			id: '7c000000-0000-4000-8000-000000000001',
			isoWeek: CURRENT_WEEK,
			startedAt: WEDNESDAY,
			completedAt: WEDNESDAY,
		});
		const done = harness({
			payoutWeekday: ISO_WEEKDAY.MONDAY,
			batch: completed,
		});
		await done.service.runPayouts();
		assert.equal(done.candidateQueries(), 0);
		assert.equal(done.batches.length, 0);
	});
});

function rejectedTransfer(code: string, param?: string) {
	const payout = Object.assign(new Payout(), {
		id: '7d000000-0000-4000-8000-000000000001',
		organizationId: PAID_HOST,
		batchId: '7c000000-0000-4000-8000-000000000002',
		amountCents: 5_000,
		amountMicroUsd: '50000000',
		createdAt: WEDNESDAY,
	});
	const stripe = new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		maxNetworkRetries: 0,
		httpClient: Stripe.createFetchHttpClient(async () =>
			Response.json(
				{
					error: {
						type: 'invalid_request_error',
						code,
						param,
						message: 'rejected',
					},
				},
				{ status: BAD_REQUEST }
			)
		),
	});
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'fork', () => manager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'execute', async () => [{ now: WEDNESDAY }]);
	mock.method(manager, 'findOne', async () => payout);
	mock.method(manager, 'findOneOrFail', async () =>
		Object.assign(new PaymentAccount(), {
			organizationId: PAID_HOST,
			stripeAccountId: `acct_${PAID_HOST}`,
		})
	);
	const accounts = fakeInstance(PaymentAccountService);
	const blocked = mock.method(accounts, 'setPayoutsBlocked', async () => {});
	const ledger = new RecordingLedger();
	const service = new PayoutService(
		manager,
		stripe,
		ledger,
		fakeSettings(),
		accounts
	);
	return { service, payout, blocked, ledger };
}

describe('PayoutService transfer rejections', () => {
	it('keeps a payout pending while the platform balance is insufficient', async () => {
		const { service, payout, blocked, ledger } = rejectedTransfer(
			StripeErrorCode.BALANCE_INSUFFICIENT
		);

		await assert.rejects(service.retry(payout.id));

		assert.equal(payout.state, PayoutState.PENDING);
		assert.deepEqual(ledger.postings, []);
		assert.equal(blocked.mock.callCount(), 0);
	});

	it('blocks the payouts of a destination account Stripe no longer has', async () => {
		const { service, payout, blocked } = rejectedTransfer(
			'resource_missing',
			StripeRequestParam.DESTINATION
		);

		await service.retry(payout.id);

		assert.equal(payout.state, PayoutState.FAILED);
		assert.deepEqual(blocked.mock.calls[0]?.arguments, [
			`acct_${PAID_HOST}`,
			PayoutsBlockedReason.ACCOUNT_CLOSED,
		]);
	});
});
