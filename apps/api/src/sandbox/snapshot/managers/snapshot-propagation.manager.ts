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
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { SECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { SANDBOX_WORKER_LIMITS } from '../../constants/sandbox.constants';
import { MachineSnapshotTargetReason } from '../../machine/enums/machine-snapshot-target-reason.enum';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import { snapshotTemplatePreparation } from '../../machine/utils/proto/snapshot-template.util';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotMachineSelectionService } from '../services/snapshot-machine-selection.service';

const PROPAGATION_LOCK_KEY = 'propagate-machine-snapshots-lock';
const PROPAGATION_LOCK_TTL_SECONDS = 10 * 60;
const PROPAGATION_OFFSET_KEY = 'propagate-machine-snapshots-skip';
const SCALE_DOWN_LOCK_KEY = 'scale-down-machine-snapshots-lock';
const SCALE_DOWN_LOCK_TTL_MINUTES = 3;
const SCALE_DOWN_LOCK_TTL_SECONDS =
	SCALE_DOWN_LOCK_TTL_MINUTES * SECONDS_PER_MINUTE;
const SCALE_DOWN_OFFSET_KEY = 'scale-down-machine-snapshots-skip';

type ActiveSnapshotPass = (snapshot: Snapshot) => Promise<void>;

@Injectable()
export class SnapshotPropagationManager extends TrackedJobs {
	protected readonly logger = new Logger(SnapshotPropagationManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		@InjectRedis() private readonly redis: Redis,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly selection: SnapshotMachineSelectionService,
		private readonly targets: MachineSnapshotTargetService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution('propagate-machine-snapshots')
	@CreateRequestContext()
	async propagateSnapshots(): Promise<void> {
		await this.eachActiveSnapshot(
			PROPAGATION_LOCK_KEY,
			PROPAGATION_LOCK_TTL_SECONDS,
			PROPAGATION_OFFSET_KEY,
			SANDBOX_WORKER_LIMITS.snapshotPropagationBatchSize,
			(snapshot) => this.propagate(snapshot)
		);
	}

	@TrackJobExecution()
	@LogExecution('scale-down-machine-snapshots')
	@CreateRequestContext()
	async scaleDownSnapshots(): Promise<void> {
		await this.eachActiveSnapshot(
			SCALE_DOWN_LOCK_KEY,
			SCALE_DOWN_LOCK_TTL_SECONDS,
			SCALE_DOWN_OFFSET_KEY,
			SANDBOX_WORKER_LIMITS.snapshotScaleDownBatchSize,
			(snapshot) => this.scaleDown(snapshot)
		);
	}

	private async propagate(snapshot: Snapshot): Promise<void> {
		const ref = snapshot.ref;
		if (!ref) return;
		const machineIds = await this.selection.propagationCandidates(snapshot);
		const template = snapshotTemplatePreparation(snapshot);
		for (const machineId of machineIds) {
			await this.entityManager.transactional((manager) =>
				this.targets.add(
					manager,
					machineId,
					ref,
					MachineSnapshotTargetReason.PROPAGATION,
					template
				)
			);
		}
	}

	private async scaleDown(snapshot: Snapshot): Promise<void> {
		const targetIds = await this.selection.scaleDownCandidates(snapshot);
		if (targetIds.length === 0) return;
		const removed = await this.entityManager.transactional((manager) =>
			this.targets.remove(manager, { id: { $in: targetIds } })
		);
		this.logger.log(
			`Stopped targeting ${removed} machines with snapshot ${snapshot.ref}`
		);
	}

	private async eachActiveSnapshot(
		lockKey: string,
		lockTtlSeconds: number,
		offsetKey: string,
		batchSize: number,
		pass: ActiveSnapshotPass
	): Promise<void> {
		await this.redisLockProvider.runExclusive(
			lockKey,
			lockTtlSeconds,
			async () => {
				const skip = Number((await this.redis.get(offsetKey)) ?? 0);
				const snapshots = await this.activeSnapshots(skip, batchSize);
				await this.redis.set(
					offsetKey,
					snapshots.length === 0 ? 0 : skip + snapshots.length
				);
				const results = await settleSequentially(snapshots, pass);
				for (const [index, result] of results.entries()) {
					if (result.status === 'rejected') {
						this.logger.error(
							`Failed to reconcile the targets of snapshot ${snapshots[index].id}: ${errorMessage(result.reason)}`
						);
					}
				}
			}
		);
	}

	private async activeSnapshots(
		skip: number,
		limit: number
	): Promise<Snapshot[]> {
		const rows = await this.entityManager.execute<{ id: string }[]>(
			`SELECT snapshot.id FROM snapshot
			 JOIN organization ON organization.id = snapshot."organizationId"
			 WHERE snapshot.state = ? AND snapshot.ref IS NOT NULL
			   AND organization."deletedAt" IS NULL
			   AND NOT (organization.suspended AND (organization."suspendedUntil" IS NULL OR organization."suspendedUntil" > CURRENT_TIMESTAMP))
			 ORDER BY snapshot."createdAt" ASC, snapshot.id ASC LIMIT ? OFFSET ?`,
			[SnapshotState.ACTIVE, limit, skip]
		);
		if (rows.length === 0) return [];
		const snapshots = await this.entityManager.find(Snapshot, {
			id: { $in: rows.map(({ id }) => id) },
		});
		const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
		return rows.flatMap(({ id }) => byId.get(id) ?? []);
	}
}
