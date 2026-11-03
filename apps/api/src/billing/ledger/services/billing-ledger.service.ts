/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { v4 } from 'uuid';
import { BILLING_LEDGER_SOURCE_LOCK_NAMESPACE } from '../../../common/constants/advisory-lock.constants';
import { canonicalJson } from '../../../common/utils/canonical-json.util';
import { moneyToScaledInteger } from '../../../common/utils/fixed-point.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import {
	BILLING_LEDGER_CURRENCY,
	type BillingLedgerAccountCode,
	type BillingLedgerOwnerKind,
	BillingLedgerSide,
	type BillingLedgerSide as LedgerSide,
} from '../constants/billing.constants';
import { BillingLedgerAccount } from '../entities/billing-ledger-account.entity';
import { BillingLedgerEntry } from '../entities/billing-ledger-entry.entity';
import { BillingLedgerTransaction } from '../entities/billing-ledger-transaction.entity';

const BILLING_LEDGER_ACCOUNT_IDENTITY = [
	'ownerKind',
	'ownerReference',
	'accountCode',
	'currency',
] as const;

export interface BillingLedgerAccountReference {
	ownerKind: BillingLedgerOwnerKind;
	ownerReference: string;
	accountCode: BillingLedgerAccountCode;
}

export interface BillingLedgerPostingEntry {
	account: BillingLedgerAccountReference;
	side: LedgerSide;
	amount: string;
}

export interface BillingLedgerPosting {
	sourceType: string;
	sourceReference: string;
	sourceVersion: number;
	descriptionCode: string;
	effectiveAt: Date;
	metadata?: Record<string, unknown>;
	entries: BillingLedgerPostingEntry[];
}

@Injectable()
export class BillingLedgerService {
	async post(
		manager: EntityManager,
		posting: BillingLedgerPosting
	): Promise<BillingLedgerTransaction> {
		this.assertBalanced(posting);
		await this.lockSource(manager, posting);
		const postingHash = this.hash(posting);
		const existing = await manager.findOne(BillingLedgerTransaction, {
			sourceType: posting.sourceType,
			sourceReference: posting.sourceReference,
			sourceVersion: posting.sourceVersion,
		});
		if (existing) {
			if (existing.postingHash !== postingHash) {
				throw new Error(
					'Billing ledger source was reused with different entries'
				);
			}
			return existing;
		}

		const postedAt = await databaseNow(manager);
		const accountIds = await this.resolveAccounts(
			manager,
			posting.entries,
			postedAt
		);
		const transaction = new BillingLedgerTransaction();
		transaction.id = v4();
		transaction.sourceType = posting.sourceType;
		transaction.sourceReference = posting.sourceReference;
		transaction.sourceVersion = posting.sourceVersion;
		transaction.postingHash = postingHash;
		transaction.descriptionCode = posting.descriptionCode;
		transaction.effectiveAt = posting.effectiveAt;
		transaction.postedAt = postedAt;
		transaction.metadata = posting.metadata ?? {};
		transaction.createdAt = postedAt;
		manager.persist(transaction);

		const entries = posting.entries.map((entry, entryNumber) => {
			const accountId = accountIds.get(accountKey(entry.account));
			if (!accountId) {
				throw new Error('Billing ledger account resolution failed');
			}
			const ledgerEntry = new BillingLedgerEntry();
			ledgerEntry.id = v4();
			ledgerEntry.transactionId = transaction.id;
			ledgerEntry.entryNumber = entryNumber;
			ledgerEntry.accountId = accountId;
			ledgerEntry.side = entry.side;
			ledgerEntry.amount = entry.amount;
			ledgerEntry.createdAt = postedAt;
			return ledgerEntry;
		});
		manager.persist(entries);
		return transaction;
	}

	private async resolveAccounts(
		manager: EntityManager,
		entries: readonly BillingLedgerPostingEntry[],
		createdAt: Date
	): Promise<Map<string, string>> {
		const unique = new Map(
			entries.map((entry) => [accountKey(entry.account), entry.account])
		);
		const references = [...unique.values()]
			.sort((left, right) => (accountKey(left) < accountKey(right) ? -1 : 1))
			.map((reference) => ({
				...reference,
				currency: BILLING_LEDGER_CURRENCY,
			}));
		await manager
			.createQueryBuilder(BillingLedgerAccount)
			.insert(
				references.map((reference) => ({ ...reference, id: v4(), createdAt }))
			)
			.onConflict([...BILLING_LEDGER_ACCOUNT_IDENTITY])
			.ignore()
			.execute('run');
		const accounts = await manager.find(BillingLedgerAccount, {
			$or: references,
		});
		return new Map(
			accounts.map((account) => [accountKey(account), account.id])
		);
	}

	private assertBalanced(posting: BillingLedgerPosting): void {
		if (posting.sourceVersion <= 0 || posting.entries.length < 2) {
			throw new Error('Billing ledger posting is incomplete');
		}
		const totals = new Map<LedgerSide, bigint>([
			[BillingLedgerSide.DEBIT, 0n],
			[BillingLedgerSide.CREDIT, 0n],
		]);
		for (const entry of posting.entries) {
			const amount = moneyToScaledInteger(entry.amount);
			const total = totals.get(entry.side);
			if (amount <= 0n) {
				throw new Error('Billing ledger entry must be positive');
			}
			if (total === undefined) {
				throw new Error('Billing ledger entry has an invalid side');
			}
			totals.set(entry.side, total + amount);
		}
		if (
			totals.get(BillingLedgerSide.DEBIT) !==
			totals.get(BillingLedgerSide.CREDIT)
		) {
			throw new Error('Billing ledger posting is not balanced');
		}
	}

	private hash(posting: BillingLedgerPosting): string {
		return createHash('sha256')
			.update(
				canonicalJson({
					...posting,
					effectiveAt: posting.effectiveAt.toISOString(),
				})
			)
			.digest('hex');
	}

	private async lockSource(
		manager: EntityManager,
		posting: BillingLedgerPosting
	): Promise<void> {
		if (!manager.isInTransaction()) {
			throw new Error(
				'Billing ledger postings require an active database transaction'
			);
		}
		const sourceKey = JSON.stringify([
			posting.sourceType,
			posting.sourceReference,
			posting.sourceVersion,
		]);
		await manager.execute(
			'SELECT pg_advisory_xact_lock(hashtextextended(?, ?))',
			[sourceKey, BILLING_LEDGER_SOURCE_LOCK_NAMESPACE]
		);
	}
}

function accountKey(reference: BillingLedgerAccountReference): string {
	return `${reference.ownerKind}\u0000${reference.ownerReference}\u0000${reference.accountCode}`;
}
