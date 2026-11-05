/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { pricedLease } from '../../billing/queries/lease-price.query';
import { BillingLineItemService } from '../../billing/services/billing-line-item.service';
import { BillingAttestationService } from '../../billing/services/evidence/billing-attestation.service';
import { BillingEvidenceBundleService } from '../../billing/services/evidence/billing-evidence-bundle.service';
import { NETWORK_USAGE_RATING_LOCK_NAMESPACE } from '../../common/constants/advisory-lock.constants';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { errorMessage } from '../../common/utils/error/error.util';
import { addMilliseconds } from '../../common/utils/time.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { lockAdvisoryKey } from '../../infra/database/utils/advisory-lock.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { priceTransfer } from '../../marketplace/utils/pricing.util';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import { NETWORK_USAGE_RATING } from '../constants/network-usage.constants';
import { NetworkUsagePeriod } from '../entities/network-usage-period.entity';
import {
	ASSIGN_EDGE_SAMPLES_SQL,
	ASSIGN_RECEIPTS_SQL,
	CLAIM_EDGE_SAMPLES_SQL,
	CLAIM_RECEIPTS_SQL,
	UNRATED_EVIDENCE_SQL,
} from '../queries/network-usage-rating.query';
import type {
	RatedEdgeEvidence,
	RatedReceiptEvidence,
	UnratedEvidenceRow,
	UnratedPeriod,
} from '../types/network-usage.types';
import { networkEvidenceBundle } from '../utils/network-evidence.util';
import {
	closedPeriodCutoff,
	groupUnratedEvidence,
	networkPeriodBytes,
} from '../utils/network-usage-period.util';

@Injectable()
export class NetworkUsageRatingService extends TrackedJobs {
	protected readonly logger = new Logger(NetworkUsageRatingService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly billingLines: BillingLineItemService,
		private readonly attestations: BillingAttestationService,
		private readonly evidenceBundles: BillingEvidenceBundleService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(NETWORK_USAGE_RATING.JOB)
	@CreateRequestContext()
	async rateClosedPeriods(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			NETWORK_USAGE_RATING.JOB,
			NETWORK_USAGE_RATING.LOCK_TTL_SECONDS,
			async () => {
				const cutoff = closedPeriodCutoff(
					await databaseNow(this.entityManager),
					NETWORK_USAGE_RATING.SETTLE_MILLISECONDS,
					NETWORK_USAGE_RATING.PERIOD_MILLISECONDS
				);
				for (
					let batch = 0;
					batch < NETWORK_USAGE_RATING.MAXIMUM_BATCHES_PER_RUN;
					batch += 1
				) {
					const rows = await this.entityManager.execute<UnratedEvidenceRow[]>(
						UNRATED_EVIDENCE_SQL,
						[cutoff, cutoff, NETWORK_USAGE_RATING.EVIDENCE_BATCH_SIZE]
					);
					for (const period of groupUnratedEvidence(
						rows,
						NETWORK_USAGE_RATING.EVIDENCE_BATCH_SIZE
					)) {
						await this.rate(period).catch((error: unknown) =>
							this.logger.error(
								`Failed to rate network usage of lease ${period.leaseId} at ${period.periodStart.toISOString()}: ${errorMessage(error)}`
							)
						);
					}
					if (rows.length < NETWORK_USAGE_RATING.EVIDENCE_BATCH_SIZE) return;
				}
			}
		);
	}

	async rate(unrated: UnratedPeriod): Promise<NetworkUsagePeriod | null> {
		return this.entityManager.fork().transactional(async (manager) => {
			await lockAdvisoryKey(
				manager,
				`${unrated.leaseId}:${unrated.periodStart.toISOString()}`,
				NETWORK_USAGE_RATING_LOCK_NAMESPACE
			);
			// Evidence that arrives after its hour was rated is billed as a
			// supplement of that hour.
			const supplement = await manager.count(NetworkUsagePeriod, {
				leaseId: unrated.leaseId,
				periodStart: unrated.periodStart,
			});
			const receipts = await manager.execute<RatedReceiptEvidence[]>(
				CLAIM_RECEIPTS_SQL,
				[unrated.receiptIds]
			);
			const edgeSamples = await manager.execute<RatedEdgeEvidence[]>(
				CLAIM_EDGE_SAMPLES_SQL,
				[unrated.edgeIds]
			);
			if (receipts.length === 0 && edgeSamples.length === 0) return null;
			const priced = await pricedLease(manager, unrated.leaseId);
			const { lease, terms } = priced;
			const placement = await manager.findOneOrFail(SandboxPlacement, {
				id: lease.placementId,
			});
			const bytes = networkPeriodBytes(receipts, edgeSamples);
			const price = priceTransfer(terms, bytes.billedEgressBytes);
			const period = manager.create(NetworkUsagePeriod, {
				id: randomUUID(),
				leaseId: lease.id,
				placementId: lease.placementId,
				sandboxId: lease.sandboxId,
				machineId: placement.machineId,
				customerOrganizationId: lease.customerOrganizationId,
				hostOrganizationId: lease.hostOrganizationId,
				assignmentGeneration: placement.assignmentGeneration,
				periodStart: unrated.periodStart,
				supplement,
				periodEnd: addMilliseconds(
					unrated.periodStart,
					NETWORK_USAGE_RATING.PERIOD_MILLISECONDS
				),
				edgeEgressBytes: bytes.edgeEgressBytes.toString(),
				edgeIngressBytes: bytes.edgeIngressBytes.toString(),
				internetEgressBytes: bytes.internetEgressBytes.toString(),
				internetIngressBytes: bytes.internetIngressBytes.toString(),
				hostEgressBytes: bytes.hostEgressBytes.toString(),
				hostIngressBytes: bytes.hostIngressBytes.toString(),
				clampedInternetEgressBytes: bytes.clampedInternetEgressBytes.toString(),
				billedEgressBytes: bytes.billedEgressBytes.toString(),
				egressRateMicroUsdPerGiB: terms.egressMicroUsdPerGiB.toString(),
				markupBasisPoints: terms.markupBasisPoints.toNumber(),
				hostMicroUsd: price.hostMicroUsd.toString(),
				markupMicroUsd: price.markupMicroUsd.toString(),
				grossMicroUsd: price.grossMicroUsd.toString(),
				receiptCount: receipts.length,
				edgeSampleCount: edgeSamples.length,
				createdAt: await databaseNow(manager),
			});
			manager.persist(period);
			await manager.flush();
			await manager.execute(ASSIGN_RECEIPTS_SQL, [
				period.id,
				receipts.map(({ id }) => id),
			]);
			await manager.execute(ASSIGN_EDGE_SAMPLES_SQL, [
				period.id,
				edgeSamples.map(({ id }) => id),
			]);
			if (price.grossMicroUsd.isPositive()) {
				const line = await this.billingLines.projectNetwork(manager, period);
				const bundle = await this.evidenceBundles.record(
					manager,
					networkEvidenceBundle(
						period,
						line,
						priced,
						receipts,
						edgeSamples,
						period.createdAt
					)
				);
				await this.attestations.corroborate(
					manager,
					line,
					bundle,
					{ charged: price, creditMicroUsd: MicroUsd.ZERO },
					period.createdAt,
					priced
				);
			}
			return period;
		});
	}
}
