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
import { MILLISECONDS_PER_HOUR } from '../../common/constants/time.constants';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { addMilliseconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { MachineMarketplaceService } from '../../marketplace/services/machine-marketplace.service';
import { NETWORK_METER_AUDIT } from '../constants/network-meter-audit.constants';
import { VerificationReviewKind } from '../enums/verification-review-kind.enum';
import {
	HOST_TRAFFIC_SQL,
	MACHINE_EGRESS_RATES_SQL,
} from '../queries/network-meter-audit.query';
import {
	anomalousMachines,
	HostTrafficVerdict,
	type MachineEgressRate,
	reconcileHostTraffic,
} from '../utils/network-meter-audit.util';
import { VerificationReviewService } from './verification-review.service';

const MISMATCH_VERDICTS: ReadonlySet<HostTrafficVerdict> = new Set([
	HostTrafficVerdict.INFLATED,
	HostTrafficVerdict.UNDERCOUNTED,
]);

interface HostTrafficRow {
	machineId: string;
	hostEgressBytes: string;
	edgeEgressBytes: string;
}

@Injectable()
export class NetworkMeterAuditService extends TrackedJobs {
	protected readonly logger = new Logger(NetworkMeterAuditService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly machines: MachineMarketplaceService,
		private readonly reviews: VerificationReviewService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(NETWORK_METER_AUDIT.JOB)
	async audit(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			NETWORK_METER_AUDIT.JOB,
			NETWORK_METER_AUDIT.LOCK_TTL_SECONDS,
			() =>
				this.entityManager.fork().transactional(async (manager) => {
					const now = await databaseNow(manager);
					const reference = `${NETWORK_METER_AUDIT.REFERENCE_PREFIX}${now.toISOString().slice(0, 10)}`;
					for (const machineId of await this.mismatchedMachines(manager, now)) {
						await this.flag(
							manager,
							machineId,
							VerificationReviewKind.NETWORK_METER_MISMATCH,
							reference
						);
					}
					for (const machineId of await this.anomalies(manager, now)) {
						await this.flag(
							manager,
							machineId,
							VerificationReviewKind.NETWORK_METER_ANOMALY,
							reference
						);
					}
				})
		);
	}

	private async mismatchedMachines(
		manager: EntityManager,
		now: Date
	): Promise<string[]> {
		const rows = await manager.execute<HostTrafficRow[]>(HOST_TRAFFIC_SQL, [
			hoursBefore(now, NETWORK_METER_AUDIT.RECONCILIATION_WINDOW_HOURS),
		]);
		return rows
			.filter((row) =>
				MISMATCH_VERDICTS.has(
					reconcileHostTraffic(
						BigInt(row.hostEgressBytes),
						BigInt(row.edgeEgressBytes)
					)
				)
			)
			.map(({ machineId }) => machineId);
	}

	private async anomalies(
		manager: EntityManager,
		now: Date
	): Promise<string[]> {
		const rates = await manager.execute<MachineEgressRate[]>(
			MACHINE_EGRESS_RATES_SQL,
			[hoursBefore(now, NETWORK_METER_AUDIT.ANOMALY_WINDOW_HOURS)]
		);
		return anomalousMachines(rates);
	}

	private async flag(
		manager: EntityManager,
		machineId: string,
		kind: VerificationReviewKind,
		reference: string
	): Promise<void> {
		this.logger.warn(`Machine ${machineId} network meter flagged: ${kind}`);
		await this.machines.restrict(manager, machineId, kind);
		await this.reviews.open(manager, machineId, kind, reference);
	}
}

function hoursBefore(now: Date, hours: number): Date {
	return addMilliseconds(now, -hours * MILLISECONDS_PER_HOUR);
}
