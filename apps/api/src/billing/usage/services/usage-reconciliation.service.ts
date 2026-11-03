/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	LockMode,
	RequestContext,
	TransactionPropagation,
} from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { addMilliseconds } from '../../../common/utils/time.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS } from '../../../sandbox/machine/constants/machine-usage.constants';
import { MachineUsageReceipt } from '../../../sandbox/machine/entities/machine-usage-receipt.entity';
import { MachineUsageEvidenceError } from '../../../sandbox/machine/exceptions/machine-usage-evidence.exception';
import { USAGE_RECONCILIATION } from '../../../usage/metering/constants/usage-accounting.constants';
import { SandboxBillableUsage } from '../../../usage/metering/entities/sandbox-billable-usage.entity';
import { verifyMachineUsageReceipt } from '../../../usage/metering/utils/evidence/machine-usage-evidence.util';
import {
	deferFailedReconciliation,
	scheduleNextReconciliation,
} from '../../../usage/metering/utils/reconciliation-schedule.util';
import { BillingEvidenceStatus } from '../../ledger/constants/billing.constants';
import { pricedLease } from '../../ledger/queries/lease-price.query';
import { BillingEvidenceBundleService } from '../../ledger/services/evidence/billing-evidence-bundle.service';
import {
	computeEvidenceBundle,
	type StoredVerifiedReceipt,
} from '../../ledger/utils/evidence/compute-evidence.util';
import { attestUsageWindow } from '../../ledger/utils/evidence/usage-attestation.util';
import { UsageBillingService } from './usage-billing.service';

@Injectable()
export class UsageReconciliationService {
	private readonly logger = new Logger(UsageReconciliationService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly billing: UsageBillingService,
		private readonly evidenceBundles: BillingEvidenceBundleService
	) {}

	async reconcilePending(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const observedAt = await databaseNow(this.entityManager);
			const candidates = await this.entityManager.find(
				SandboxBillableUsage,
				{
					evidenceStatus: BillingEvidenceStatus.PENDING,
					nextReconcileAt: { $lte: observedAt },
				},
				{
					fields: ['id'],
					orderBy: { nextReconcileAt: 'ASC', id: 'ASC' },
					limit: USAGE_RECONCILIATION.BATCH_SIZE,
				}
			);
			for (const candidate of candidates) {
				try {
					await this.reconcile(candidate.id);
				} catch (error) {
					this.logger.error(
						`Failed to reconcile billable usage ${candidate.id}`,
						error
					);
					await this.deferAfterFailure(candidate.id);
				}
			}
		});
	}

	async reconcile(billableId: string): Promise<SandboxBillableUsage> {
		return this.entityManager.transactional(
			async (manager) => {
				const billable = await manager.findOne(
					SandboxBillableUsage,
					{ id: billableId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!billable) throw new Error('Billable usage record was not found');
				if (billable.evidenceStatus !== BillingEvidenceStatus.PENDING) {
					return billable;
				}
				const line = await this.billing.lockLine(manager, billable);
				const receipts = await this.verifiedReceipts(manager, billable);
				const { lease, terms } = await pricedLease(manager, billable.leaseId);
				const attestation = attestUsageWindow(
					billable,
					terms,
					receipts.map(({ verified }) => verified)
				);
				const observedAt = await databaseNow(manager);
				const deadline = addMilliseconds(
					billable.endAt,
					MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS
				);
				if (attestation.creditMicroUsd.isPositive() && observedAt < deadline) {
					scheduleNextReconciliation(billable, observedAt);
					return billable;
				}
				const bundle = await this.evidenceBundles.record(
					manager,
					computeEvidenceBundle(
						billable,
						line,
						receipts,
						attestation,
						observedAt,
						lease
					)
				);
				return this.billing.corroborate(
					manager,
					billable,
					line,
					bundle,
					attestation,
					observedAt,
					{ lease, terms }
				);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async verifiedReceipts(
		manager: EntityManager,
		billable: SandboxBillableUsage
	): Promise<StoredVerifiedReceipt[]> {
		const rows = await manager.find(
			MachineUsageReceipt,
			{
				placementId: billable.placementId,
				machineId: billable.machineId,
				assignmentGeneration: billable.assignmentGeneration,
				sampledAt: { $gt: billable.startAt },
				intervalStartAt: { $lt: billable.endAt },
			},
			{ orderBy: { sequence: 'ASC', id: 'ASC' } }
		);
		const predecessorIds = rows.flatMap(({ predecessorId }) =>
			predecessorId ? [predecessorId] : []
		);
		const predecessors = new Map(
			(
				await manager.find(MachineUsageReceipt, {
					id: { $in: predecessorIds },
				})
			).map((row) => [row.id, row])
		);
		return rows.flatMap((row) => {
			const predecessor = row.predecessorId
				? (predecessors.get(row.predecessorId) ?? null)
				: null;
			try {
				return [
					{
						id: row.id,
						verified: verifyMachineUsageReceipt(
							billable.machineId,
							row,
							predecessor
						),
					},
				];
			} catch (error) {
				if (!(error instanceof MachineUsageEvidenceError)) throw error;
				this.logger.warn(
					`Usage receipt ${row.id} does not verify and attests nothing: ${error.message}`
				);
				return [];
			}
		});
	}

	private async deferAfterFailure(billableId: string): Promise<void> {
		try {
			await this.entityManager.fork().transactional(async (manager) => {
				const billable = await manager.findOne(
					SandboxBillableUsage,
					{ id: billableId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!billable) return;
				deferFailedReconciliation(billable, await databaseNow(manager));
			});
		} catch (error) {
			this.logger.error(
				`Failed to defer reconciliation of billable usage ${billableId}`,
				error
			);
		}
	}
}
