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
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { IsolatedEntityManagerContext } from '../../../common/decorators/isolated-entity-manager-context.decorator';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { OnAsyncEvent } from '../../../common/decorators/on-async-event.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { millisecondsBetween } from '../../../common/utils/time.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { SANDBOX_WORKER_LIMITS } from '../../constants/sandbox.constants';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineService } from '../../machine/services/machine.service';
import { MachineSchedulingService } from '../../placement/services/machine-scheduling.service';
import { platformWorkloadPlacement } from '../../placement/utils/sandbox-placement.util';
import { SnapshotEvents } from '../constants/snapshot-events.constants';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotActivatedEvent } from '../events/snapshot-activated.event';
import { SnapshotCreatedEvent } from '../events/snapshot-created.event';
import { SnapshotRepository } from '../repositories/snapshot.repository';
import { SnapshotActivationService } from '../services/snapshot-activation.service';
import { SnapshotPublicationService } from '../services/snapshot-publication.service';

const SNAPSHOT_STATE_LOCK_TTL_SECONDS = 60;
const SNAPSHOT_STATE_WORKER_LOCK = 'check-snapshot-state-worker-lock';
const SNAPSHOT_STATE_WORKER_LOCK_TTL_SECONDS = 10 * 60;
const PUBLICATION_TIMEOUT_MS = 60 * MILLISECONDS_PER_MINUTE;
const PUBLICATION_TIMEOUT_REASON =
	'Timeout publishing snapshot on its initial machine';
const CREATING_STATES = [
	SnapshotState.PENDING,
	SnapshotState.PULLING,
	SnapshotState.BUILDING,
];

@Injectable()
export class SnapshotLifecycleManager extends TrackedJobs {
	protected readonly logger = new Logger(SnapshotLifecycleManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly snapshotRepository: SnapshotRepository,
		private readonly machineService: MachineService,
		private readonly machineScheduling: MachineSchedulingService,
		private readonly publication: SnapshotPublicationService,
		private readonly activation: SnapshotActivationService,
		private readonly redisLockProvider: RedisLockProvider
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution('check-snapshot-state')
	@CreateRequestContext()
	async checkSnapshotState(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			SNAPSHOT_STATE_WORKER_LOCK,
			SNAPSHOT_STATE_WORKER_LOCK_TTL_SECONDS,
			async () => {
				const snapshots = await this.entityManager.find(
					Snapshot,
					{ state: { $in: CREATING_STATES } },
					{
						orderBy: { updatedAt: 'ASC', id: 'ASC' },
						limit: SANDBOX_WORKER_LIMITS.snapshotBatchSize,
					}
				);
				const results = await settleSequentially(snapshots, (snapshot) =>
					this.syncSnapshotState(snapshot.id)
				);
				for (const [index, result] of results.entries()) {
					if (result.status === 'rejected') {
						this.logger.error(
							`Error syncing snapshot state for snapshot ${snapshots[index].id}: ${errorMessage(result.reason)}`
						);
					}
				}
			}
		);
	}

	async syncSnapshotState(snapshotId: string): Promise<void> {
		await this.redisLockProvider.runExclusive(
			`sync-snapshot-state-${snapshotId}`,
			SNAPSHOT_STATE_LOCK_TTL_SECONDS,
			async () => {
				const snapshot = await this.entityManager.findOne(
					Snapshot,
					{ id: snapshotId, state: { $in: CREATING_STATES } },
					{ populate: ['buildInfo'] }
				);
				if (!snapshot) return;
				try {
					await this.advance(snapshot);
				} catch (error) {
					await this.fail(snapshot, SnapshotState.ERROR, errorMessage(error));
				}
			}
		);
	}

	private async advance(snapshot: Snapshot): Promise<void> {
		if (snapshot.state === SnapshotState.PENDING) {
			await this.start(snapshot);
			return;
		}
		if (
			millisecondsBetween(snapshot.updatedAt, new Date()) >
			PUBLICATION_TIMEOUT_MS
		) {
			await this.fail(
				snapshot,
				SnapshotState.ERROR,
				PUBLICATION_TIMEOUT_REASON
			);
			return;
		}
		await this.activation.activateIfHeld(snapshot);
	}

	private async start(snapshot: Snapshot): Promise<void> {
		const machine = await this.initialMachine(snapshot);
		if (!machine) return;
		if (snapshot.buildInfo) {
			await this.updateState(snapshot, SnapshotState.BUILDING);
			try {
				await this.publication.build(snapshot, machine);
			} catch (error) {
				await this.fail(
					snapshot,
					SnapshotState.BUILD_FAILED,
					errorMessage(error)
				);
			}
			return;
		}
		if (!snapshot.ref && !(await this.publication.inspect(snapshot, machine))) {
			return;
		}
		await this.updateState(snapshot, SnapshotState.PULLING);
		await this.publication.publish(snapshot, machine);
	}

	private async initialMachine(snapshot: Snapshot): Promise<Machine | null> {
		if (snapshot.initialMachineId) {
			return this.machineService.findOneOrFail(snapshot.initialMachineId);
		}
		const machine = await this.machineScheduling
			.findBestAvailableMachine({
				customerOrganizationId: snapshot.organizationId ?? null,
				placement: platformWorkloadPlacement(),
				sandboxClass: snapshot.sandboxClass,
				gpu: snapshot.gpu,
				gpuType: snapshot.gpuType ?? null,
			})
			.catch((error: unknown) => {
				this.logger.warn(
					`Failed to get initial machine: ${errorMessage(error)}`
				);
				return null;
			});
		if (machine) {
			await this.snapshotRepository.update(snapshot.id, {
				updateData: { initialMachineId: machine.id },
				entity: snapshot,
			});
		}
		return machine;
	}

	private async updateState(
		snapshot: Snapshot,
		state: SnapshotState
	): Promise<void> {
		await this.snapshotRepository.update(snapshot.id, {
			updateData: { state },
			entity: snapshot,
		});
	}

	private async fail(
		snapshot: Snapshot,
		state: SnapshotState,
		errorReason: string
	): Promise<void> {
		await this.snapshotRepository.update(snapshot.id, {
			updateData: { state, errorReason },
			entity: snapshot,
		});
	}

	@OnAsyncEvent({ event: SnapshotEvents.CREATED })
	@IsolatedEntityManagerContext()
	private async handleSnapshotCreatedEvent(
		event: SnapshotCreatedEvent
	): Promise<void> {
		await this.syncSnapshotState(event.snapshot.id);
	}

	@OnAsyncEvent({ event: SnapshotEvents.ACTIVATED })
	@IsolatedEntityManagerContext()
	private async handleSnapshotActivatedEvent(
		event: SnapshotActivatedEvent
	): Promise<void> {
		await this.syncSnapshotState(event.snapshot.id);
	}
}
