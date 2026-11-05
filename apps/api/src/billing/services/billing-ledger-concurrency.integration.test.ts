/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import {
	BillingLedgerAccountCode,
	BillingLedgerDescriptionCode,
	BillingLedgerOwnerKind,
	BillingLedgerSide,
	BillingLedgerSourceType,
} from '../constants/billing.constants';
import { BillingLedgerAccount } from '../entities/billing-ledger-account.entity';
import { BillingLedgerEntry } from '../entities/billing-ledger-entry.entity';
import { BillingLedgerTransaction } from '../entities/billing-ledger-transaction.entity';
import { ledgerBalance } from '../queries/ledger-balance.query';
import {
	customerCreditAccount,
	platformAccount,
} from '../utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../utils/ledger/ledger-posting-builder.util';
import {
	type BillingLedgerAccountReference,
	type BillingLedgerPosting,
	BillingLedgerService,
} from './billing-ledger.service';

const DATABASE_URL = integrationDatabaseUrl();
const BARRIER_TIMEOUT_MILLISECONDS = 5 * MILLISECONDS_PER_SECOND;
const PARALLEL_ORGANIZATIONS = 6;
const OPPOSITE_ORDER_ROUNDS = 20;
const GRANT_MICRO_USD = MicroUsd.of(10_000_000n);
const CHARGE_MICRO_USD = MicroUsd.of(4_000_000n);
const SWAP_AMOUNT = '1000';
const EFFECTIVE_AT = new Date('2026-10-19T12:00:00.000Z');

interface Barrier {
	arrive(): Promise<void>;
}

function barrier(parties: number): Barrier {
	let arrived = 0;
	let release = () => {};
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});
	return {
		async arrive() {
			arrived += 1;
			if (arrived === parties) release();
			const timedOut = sleep(BARRIER_TIMEOUT_MILLISECONDS).then(() => {
				throw new Error(
					`Only ${arrived} of ${parties} concurrent postings reached the barrier`
				);
			});
			await Promise.race([released, timedOut]);
		},
	};
}

describe('billing ledger concurrency', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	const ledger = new BillingLedgerService();
	const platformOwner = `ledger-concurrency-${randomUUID()}`;

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [
				BillingLedgerAccount,
				BillingLedgerEntry,
				BillingLedgerTransaction,
			],
		});
	});

	after(async () => {
		if (orm) await orm.close(true);
	});

	it('posts a credit grant and a charge for one organization concurrently', async () => {
		const organizationId = randomUUID();
		await postAll([grant(organizationId), charge(organizationId)]);

		const meeting = barrier(2);
		const outcomes = await Promise.allSettled([
			postTogether(meeting, [grant(organizationId)]),
			postTogether(meeting, [charge(organizationId)]),
		]);

		assert.deepEqual(statuses(outcomes), ['fulfilled', 'fulfilled']);
		const credit = GRANT_MICRO_USD.subtract(CHARGE_MICRO_USD).multiply(2n);
		assert.equal(
			(
				await ledgerBalance(
					orm.em.fork(),
					customerCreditAccount(organizationId)
				)
			).toString(),
			credit.toString()
		);
	});

	it('does not serialize postings of different organizations on shared platform accounts', async () => {
		const organizationIds = Array.from({ length: PARALLEL_ORGANIZATIONS }, () =>
			randomUUID()
		);
		await postAll(organizationIds.map((id) => grant(id)));

		const meeting = barrier(organizationIds.length);
		const outcomes = await Promise.allSettled(
			organizationIds.map((id) => postTogether(meeting, [grant(id)]))
		);

		assert.deepEqual(
			statuses(outcomes),
			organizationIds.map(() => 'fulfilled')
		);
	});

	it('creates new accounts in one global order whatever the entry order', async () => {
		const rounds = Array.from({ length: OPPOSITE_ORDER_ROUNDS }, () => [
			platform(randomUUID()),
			platform(randomUUID()),
		]);
		const outcomes = await Promise.allSettled(
			rounds.flatMap(([left, right]) => [
				postAll([swap(left, right)]),
				postAll([swap(right, left)]),
			])
		);

		assert.deepEqual(
			statuses(outcomes),
			outcomes.map(() => 'fulfilled')
		);
		const accountCount = await orm.em.fork().count(BillingLedgerAccount, {
			ownerReference: {
				$in: rounds.flat().map((account) => account.ownerReference),
			},
		});
		assert.equal(accountCount, rounds.flat().length);
	});

	it('records a concurrently repeated source exactly once', async () => {
		const organizationId = randomUUID();
		const posting = grant(organizationId);
		const outcomes = await Promise.allSettled([
			postAll([posting]),
			postAll([posting]),
		]);

		assert.deepEqual(statuses(outcomes), ['fulfilled', 'fulfilled']);
		assert.equal(
			await orm.em.fork().count(BillingLedgerTransaction, {
				sourceType: posting.sourceType,
				sourceReference: posting.sourceReference,
			}),
			1
		);
	});

	function postAll(postings: readonly BillingLedgerPosting[]): Promise<void> {
		return orm.em.fork().transactional(async (manager) => {
			await post(manager, postings);
		});
	}

	function postTogether(
		meeting: Barrier,
		postings: readonly BillingLedgerPosting[]
	): Promise<void> {
		return orm.em.fork().transactional(async (manager) => {
			await post(manager, postings);
			await manager.flush();
			await meeting.arrive();
		});
	}

	async function post(
		manager: EntityManager,
		postings: readonly BillingLedgerPosting[]
	): Promise<void> {
		for (const posting of postings) {
			await ledger.post(manager, posting);
		}
	}

	function grant(organizationId: string): BillingLedgerPosting {
		return relocated(
			LedgerPostingBuilder.for({
				sourceType: BillingLedgerSourceType.ADMIN_CREDIT_GRANT,
				descriptionCode: BillingLedgerDescriptionCode.ADMIN_CREDIT_GRANTED,
				sourceReference: randomUUID(),
				effectiveAt: EFFECTIVE_AT,
				metadata: { organizationId },
			})
				.debit(
					platformAccount(BillingLedgerAccountCode.ADMIN_CREDIT_GRANTS),
					GRANT_MICRO_USD
				)
				.credit(customerCreditAccount(organizationId), GRANT_MICRO_USD)
				.build()
		);
	}

	function charge(organizationId: string): BillingLedgerPosting {
		return relocated(
			LedgerPostingBuilder.for({
				sourceType: BillingLedgerSourceType.LINE_USAGE,
				descriptionCode: BillingLedgerDescriptionCode.USAGE_CHARGED,
				sourceReference: randomUUID(),
				effectiveAt: EFFECTIVE_AT,
				metadata: { organizationId },
			})
				.debit(customerCreditAccount(organizationId), CHARGE_MICRO_USD)
				.credit(
					platformAccount(BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE),
					CHARGE_MICRO_USD
				)
				.build()
		);
	}

	function relocated(posting: BillingLedgerPosting): BillingLedgerPosting {
		return {
			...posting,
			entries: posting.entries.map((entry) =>
				entry.account.ownerKind === BillingLedgerOwnerKind.PLATFORM
					? { ...entry, account: platform(platformOwner, entry.account) }
					: entry
			),
		};
	}

	function platform(
		ownerReference: string,
		account?: BillingLedgerAccountReference
	): BillingLedgerAccountReference {
		return {
			ownerKind: BillingLedgerOwnerKind.PLATFORM,
			ownerReference,
			accountCode:
				account?.accountCode ?? BillingLedgerAccountCode.ADMIN_CREDIT_GRANTS,
		};
	}

	function swap(
		debit: BillingLedgerAccountReference,
		credit: BillingLedgerAccountReference
	): BillingLedgerPosting {
		return {
			sourceType: 'ledger_concurrency_test',
			sourceReference: randomUUID(),
			sourceVersion: 1,
			descriptionCode: 'ledger_concurrency_test',
			effectiveAt: EFFECTIVE_AT,
			entries: [
				{ account: debit, side: BillingLedgerSide.DEBIT, amount: SWAP_AMOUNT },
				{
					account: credit,
					side: BillingLedgerSide.CREDIT,
					amount: SWAP_AMOUNT,
				},
			],
		};
	}
});

function statuses(
	outcomes: readonly PromiseSettledResult<unknown>[]
): string[] {
	return outcomes.map((outcome) =>
		outcome.status === 'rejected' ? String(outcome.reason) : outcome.status
	);
}
