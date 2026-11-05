/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import {
	HOURS_PER_DAY,
	MINUTES_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../../common/constants/time.constants';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { SANDBOX_WORKER_LIMITS } from '../../constants/sandbox.constants';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotRepository } from '../repositories/snapshot.repository';

const CLEANUP_LOCK_KEY = 'check-snapshot-cleanup-lock';
const CLEANUP_LOCK_TTL_SECONDS = 30;
const DEACTIVATION_LOCK_KEY = 'deactivate-old-snapshots-lock';
const DEACTIVATION_LOCK_TTL_MINUTES = 5;
const DEACTIVATION_LOCK_TTL_SECONDS =
	DEACTIVATION_LOCK_TTL_MINUTES * SECONDS_PER_MINUTE;
const DEACTIVATION_BATCH_SIZE = 100;
const DEFAULT_DEACTIVATION_TIMEOUT_DAYS = 14;
const DEFAULT_DEACTIVATION_TIMEOUT_MINUTES =
	DEFAULT_DEACTIVATION_TIMEOUT_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR;

@Injectable()
export class SnapshotRetirementManager extends TrackedJobs {
	protected readonly logger = new Logger(SnapshotRetirementManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly snapshotRepository: SnapshotRepository,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly targets: MachineSnapshotTargetService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution('check-snapshot-cleanup')
	@CreateRequestContext()
	async removeSnapshots(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			CLEANUP_LOCK_KEY,
			CLEANUP_LOCK_TTL_SECONDS,
			async () => {
				const snapshots = await this.entityManager.find(
					Snapshot,
					{ state: SnapshotState.REMOVING },
					{
						orderBy: { createdAt: 'ASC', id: 'ASC' },
						limit: SANDBOX_WORKER_LIMITS.snapshotBatchSize,
					}
				);
				await this.stopTargetingUnusedRefs(snapshots);
				await this.snapshotRepository.removeManyAndFlush(snapshots);
			}
		);
	}

	@TrackJobExecution()
	@LogExecution('deactivate-old-snapshots')
	@CreateRequestContext()
	async deactivateOldSnapshots(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			DEACTIVATION_LOCK_KEY,
			DEACTIVATION_LOCK_TTL_SECONDS,
			async () => {
				const snapshots = await this.staleSnapshots();
				const results = await settleSequentially(snapshots, (snapshot) =>
					this.snapshotRepository.update(snapshot.id, {
						updateData: { state: SnapshotState.INACTIVE },
						entity: snapshot,
					})
				);
				const deactivated = snapshots.filter((snapshot, index) => {
					const result = results[index];
					if (result.status === 'rejected') {
						this.logger.warn(
							`Failed to deactivate snapshot ${snapshot.id}: ${errorMessage(result.reason)}`
						);
					}
					return result.status === 'fulfilled';
				});
				await this.stopTargetingUnusedRefs(deactivated);
			}
		);
	}

	private async stopTargetingUnusedRefs(
		snapshots: readonly Snapshot[]
	): Promise<void> {
		const refs = snapshots.flatMap(({ ref }) => (ref ? [ref] : []));
		await this.entityManager.transactional((manager) =>
			this.targets.removeInactivePropagation(manager, refs)
		);
	}

	private async staleSnapshots(): Promise<Snapshot[]> {
		const rows = await this.entityManager.execute<{ id: string }[]>(
			`SELECT snapshot.id FROM snapshot
			LEFT JOIN organization_limits limits ON limits."organizationId" = snapshot."organizationId"
			WHERE snapshot.general = false AND snapshot.state = ?
				AND (snapshot."lastUsedAt" IS NULL OR snapshot."lastUsedAt" < NOW() - INTERVAL '1 minute' * COALESCE(limits."snapshot_deactivation_timeout_minutes", ?))
				AND snapshot."createdAt" < NOW() - INTERVAL '1 minute' * COALESCE(limits."snapshot_deactivation_timeout_minutes", ?)
				AND NOT EXISTS (
					SELECT 1 FROM snapshot active_snapshot
					WHERE active_snapshot.ref = snapshot.ref AND active_snapshot.state = ?
						AND (active_snapshot."lastUsedAt" >= NOW() - INTERVAL '1 minute' * COALESCE(limits."snapshot_deactivation_timeout_minutes", ?)
							OR active_snapshot."createdAt" >= NOW() - INTERVAL '1 minute' * COALESCE(limits."snapshot_deactivation_timeout_minutes", ?))
				)
			LIMIT ?`,
			[
				SnapshotState.ACTIVE,
				DEFAULT_DEACTIVATION_TIMEOUT_MINUTES,
				DEFAULT_DEACTIVATION_TIMEOUT_MINUTES,
				SnapshotState.ACTIVE,
				DEFAULT_DEACTIVATION_TIMEOUT_MINUTES,
				DEFAULT_DEACTIVATION_TIMEOUT_MINUTES,
				DEACTIVATION_BATCH_SIZE,
			]
		);
		if (rows.length === 0) return [];
		return this.entityManager.find(Snapshot, {
			id: { $in: rows.map(({ id }) => id) },
		});
	}
}
