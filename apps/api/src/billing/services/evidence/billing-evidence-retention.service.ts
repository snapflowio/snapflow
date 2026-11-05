/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { RETENTION_POLICY } from '../../../common/constants/retention-policy.constants';
import { errorMessage } from '../../../common/utils/error/error.util';
import { pruneInBatches } from '../../../infra/database/utils/batched-prune.util';
import { EdgeUsageCheckpoint } from '../../../networking/entities/edge-usage-checkpoint.entity';
import { ExposureNetworkUsage } from '../../../networking/usage/entities/exposure-network-usage.entity';
import { MachineUsageReceipt } from '../../../sandbox/machine/entities/machine-usage-receipt.entity';
import { BILLING_EVIDENCE_RETENTION } from '../../constants/billing.constants';
import { BillingEvidenceBundle } from '../../entities/billing-evidence-bundle.entity';
import {
	PRUNABLE_RECEIPT_PLACEMENTS_SQL,
	placementReceipts,
	postedEvidenceBundles,
	ratedNetworkUsage,
	supersededEdgeCheckpoints,
} from '../../queries/billing-evidence-retention.query';

const BATCH_LIMITS = {
	batchSize: BILLING_EVIDENCE_RETENTION.batchSize,
	maximumBatches: BILLING_EVIDENCE_RETENTION.maximumBatches,
};

export interface PrunedBillingEvidence {
	evidenceBundles: number;
	networkUsage: number;
	edgeCheckpoints: number;
	usageReceipts: number;
}

@Injectable()
export class BillingEvidenceRetentionService {
	private readonly logger = new Logger(BillingEvidenceRetentionService.name);

	constructor(private readonly entityManager: EntityManager) {}

	async prune(): Promise<void> {
		const pruned = await this.prunePostedEvidence();
		if (Object.values(pruned).some((count) => count > 0)) {
			this.logger.log(
				`Pruned posted billing evidence: ${JSON.stringify(pruned)}`
			);
		}
	}

	async prunePostedEvidence(): Promise<PrunedBillingEvidence> {
		const retentionDays = RETENTION_POLICY.billingEvidenceDays;
		return {
			evidenceBundles: await this.attempt('evidence bundles', () =>
				pruneInBatches(this.entityManager, {
					...BATCH_LIMITS,
					...postedEvidenceBundles(retentionDays),
					entity: BillingEvidenceBundle,
				})
			),
			networkUsage: await this.attempt('network usage', () =>
				pruneInBatches(this.entityManager, {
					...BATCH_LIMITS,
					...ratedNetworkUsage(retentionDays),
					entity: ExposureNetworkUsage,
				})
			),
			edgeCheckpoints: await this.attempt('Edge usage checkpoints', () =>
				pruneInBatches(this.entityManager, {
					...BATCH_LIMITS,
					...supersededEdgeCheckpoints(retentionDays),
					entity: EdgeUsageCheckpoint,
				})
			),
			usageReceipts: await this.attempt('usage receipts', () =>
				this.pruneUsageReceipts(retentionDays)
			),
		};
	}

	private async pruneUsageReceipts(retentionDays: number): Promise<number> {
		const placements = await this.entityManager
			.getConnection()
			.execute<{ placementId: string }[]>(PRUNABLE_RECEIPT_PLACEMENTS_SQL, [
				retentionDays,
				retentionDays,
				BILLING_EVIDENCE_RETENTION.maximumPlacementsPerRun,
			]);
		let deleted = 0;
		for (const { placementId } of placements) {
			deleted += await pruneInBatches(this.entityManager, {
				...BATCH_LIMITS,
				...placementReceipts(placementId),
				entity: MachineUsageReceipt,
			});
		}
		return deleted;
	}

	private async attempt(
		evidence: string,
		prune: () => Promise<number>
	): Promise<number> {
		try {
			return await prune();
		} catch (error) {
			this.logger.error(
				`Failed to prune posted ${evidence}: ${errorMessage(error)}`
			);
			return 0;
		}
	}
}
