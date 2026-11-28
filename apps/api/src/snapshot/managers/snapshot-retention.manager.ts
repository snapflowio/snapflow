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
import { RETENTION_POLICY } from '../../common/constants/retention-policy.constants';
import { SECONDS_PER_MINUTE } from '../../common/constants/time.constants';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { MACHINE_SNAPSHOT_TARGETS } from '../../machine/constants/machine-snapshot.constants';
import { MachineSnapshotTargetReason } from '../../machine/enums/machine-snapshot-target-reason.enum';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import { SnapshotMachine } from '../entities/snapshot-machine.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';

const RETENTION_LOCK_KEY = 'prune-machine-snapshot-targets-lock';
const RETENTION_LOCK_TTL_MINUTES = 5;
const RETENTION_LOCK_TTL_SECONDS =
	RETENTION_LOCK_TTL_MINUTES * SECONDS_PER_MINUTE;

@Injectable()
export class SnapshotRetentionManager extends TrackedJobs {
	protected readonly logger = new Logger(SnapshotRetentionManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly targets: MachineSnapshotTargetService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution('prune-machine-snapshot-targets')
	@CreateRequestContext()
	async pruneTargets(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			RETENTION_LOCK_KEY,
			RETENTION_LOCK_TTL_SECONDS,
			async () => {
				const removed =
					(await this.removeTargets(this.unusedPropagationSql(), [
						MachineSnapshotTargetReason.PROPAGATION,
						SnapshotState.ACTIVE,
					])) +
					(await this.removeTargets(this.staleBuildCacheSql(), [
						MachineSnapshotTargetReason.BUILD_CACHE,
						RETENTION_POLICY.buildCacheIdleDays,
					])) +
					(await this.removeDecommissioned());
				if (removed > 0) {
					this.logger.debug(`Stopped targeting ${removed} machine snapshots`);
				}
			}
		);
	}

	private unusedPropagationSql(): string {
		return `SELECT target.id FROM machine_snapshot_target target
			WHERE target.reason = ?
			  AND NOT EXISTS (
			    SELECT 1 FROM snapshot
			    WHERE snapshot.ref = target."snapshotRef" AND snapshot.state = ?
			  )
			LIMIT ?`;
	}

	private staleBuildCacheSql(): string {
		return `SELECT target.id FROM machine_snapshot_target target
			LEFT JOIN build_info ON build_info."snapshotRef" = target."snapshotRef"
			WHERE target.reason = ?
			  AND (build_info."snapshotRef" IS NULL
			    OR build_info."lastUsedAt" < now() - (? * interval '1 day'))
			LIMIT ?`;
	}

	private async removeTargets(
		sql: string,
		bindings: unknown[]
	): Promise<number> {
		const rows = await this.entityManager.execute<{ id: string }[]>(sql, [
			...bindings,
			MACHINE_SNAPSHOT_TARGETS.retentionBatchSize,
		]);
		if (rows.length === 0) return 0;
		return this.entityManager.transactional((manager) =>
			this.targets.remove(manager, { id: { $in: rows.map(({ id }) => id) } })
		);
	}

	private async removeDecommissioned(): Promise<number> {
		const rows = await this.entityManager.execute<{ id: string }[]>(
			'SELECT machine.id FROM machine WHERE machine.state = ? LIMIT ?',
			[MachineState.DECOMMISSIONED, MACHINE_SNAPSHOT_TARGETS.retentionBatchSize]
		);
		if (rows.length === 0) return 0;
		const machineIds = rows.map(({ id }) => id);
		return this.entityManager.transactional(async (manager) => {
			await manager.nativeDelete(SnapshotMachine, {
				machineId: { $in: machineIds },
			});
			return this.targets.remove(manager, { machineId: { $in: machineIds } });
		});
	}
}
