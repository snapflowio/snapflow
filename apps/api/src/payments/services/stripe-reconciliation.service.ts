/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
	BILLING_LEDGER_SOURCE_VERSION,
	BillingLedgerAccountCode,
} from '../../billing/constants/billing.constants';
import { BillingLedgerTransaction } from '../../billing/entities/billing-ledger-transaction.entity';
import { ledgerBalance } from '../../billing/queries/ledger-balance.query';
import { BillingLedgerService } from '../../billing/services/billing-ledger.service';
import { platformAccount } from '../../billing/utils/ledger/billing-ledger-accounts.util';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { addMilliseconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { STRIPE_RECONCILIATION } from '../constants/payments.constants';
import { STRIPE_CLIENT, STRIPE_CURRENCY } from '../constants/stripe.constants';
import { stripePlatformFeePosting } from '../utils/postings/stripe-fee-posting.util';
import {
	stripeAmountMicroUsd,
	stripeTimestamp,
} from '../utils/stripe-amount.util';
import {
	type ExpectedLedgerSource,
	ReconciliationKind,
	reconcileBalanceTransaction,
} from '../utils/stripe-reconciliation.util';

export interface StripeReconciliationReport {
	transactions: number;
	platformFeesPosted: number;
	discrepancies: number;
}

@Injectable()
export class StripeReconciliationService {
	private readonly logger = new Logger(StripeReconciliationService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly ledger: BillingLedgerService
	) {}

	async reconcileDaily(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const report = await this.reconcile();
			this.logger.log(
				`Stripe reconciliation checked ${report.transactions} balance transactions, posted ${report.platformFeesPosted} platform fees, found ${report.discrepancies} discrepancies`
			);
		});
	}

	async reconcile(): Promise<StripeReconciliationReport> {
		const now = await databaseNow(this.entityManager);
		const since = Math.floor(
			addMilliseconds(
				now,
				-STRIPE_RECONCILIATION.lookbackMilliseconds
			).getTime() / MILLISECONDS_PER_SECOND
		);
		const report: StripeReconciliationReport = {
			transactions: 0,
			platformFeesPosted: 0,
			discrepancies: 0,
		};
		for await (const transaction of this.stripe.balanceTransactions.list({
			created: { gte: since },
			limit: STRIPE_RECONCILIATION.pageSize,
		})) {
			report.transactions += 1;
			await this.reconcileTransaction(transaction, report);
		}
		if (!(await this.balanceMatches())) report.discrepancies += 1;
		return report;
	}

	private async reconcileTransaction(
		transaction: Stripe.BalanceTransaction,
		report: StripeReconciliationReport
	): Promise<void> {
		const reconciliation = reconcileBalanceTransaction(transaction);
		switch (reconciliation.kind) {
			case ReconciliationKind.PLATFORM_FEE:
				await this.postPlatformFee(transaction);
				report.platformFeesPosted += 1;
				return;
			case ReconciliationKind.UNMAPPED:
				this.discrepancy(transaction, 'has no ledger mapping');
				report.discrepancies += 1;
				return;
			case ReconciliationKind.EXPECTED:
				for (const source of reconciliation.sources) {
					if (!(await this.posted(source))) {
						this.discrepancy(
							transaction,
							`is missing ledger source ${source.sourceTypes.join('|')}:${source.sourceReference}`
						);
						report.discrepancies += 1;
					}
				}
		}
	}

	private async postPlatformFee(
		transaction: Stripe.BalanceTransaction
	): Promise<void> {
		await this.entityManager.fork().transactional((manager) =>
			this.ledger.post(
				manager,
				stripePlatformFeePosting({
					balanceTransactionId: transaction.id,
					balanceTransactionType: transaction.type,
					feeMicroUsd: stripeAmountMicroUsd(
						transaction.amount,
						transaction.currency
					).negate(),
					effectiveAt: stripeTimestamp(transaction.created),
				})
			)
		);
	}

	private async posted(source: ExpectedLedgerSource): Promise<boolean> {
		const count = await this.entityManager
			.fork()
			.count(BillingLedgerTransaction, {
				sourceType: { $in: [...source.sourceTypes] },
				sourceReference: source.sourceReference,
				sourceVersion: BILLING_LEDGER_SOURCE_VERSION,
			});
		return count > 0;
	}

	private async balanceMatches(): Promise<boolean> {
		const balance = await this.stripe.balance.retrieve();
		const stripeCents = [
			...balance.available,
			...balance.pending,
			...(balance.connect_reserved ?? []),
		]
			.filter((amount) => amount.currency === STRIPE_CURRENCY)
			.reduce((total, amount) => total + amount.amount, 0);
		const stripeMicroUsd = stripeAmountMicroUsd(stripeCents, STRIPE_CURRENCY);
		const ledgerMicroUsd = await ledgerBalance(
			this.entityManager.fork(),
			platformAccount(BillingLedgerAccountCode.STRIPE_BALANCE)
		);
		if (stripeMicroUsd.equals(ledgerMicroUsd)) return true;
		this.logger.error(
			`Stripe balance discrepancy: Stripe holds ${stripeMicroUsd} µUSD, the ledger stripe_balance holds ${ledgerMicroUsd} µUSD`
		);
		return false;
	}

	private discrepancy(
		transaction: Stripe.BalanceTransaction,
		problem: string
	): void {
		this.logger.error(
			`Stripe reconciliation discrepancy: balance transaction ${transaction.id} (${transaction.type}, ${transaction.amount} ${transaction.currency}) ${problem}`
		);
	}
}
