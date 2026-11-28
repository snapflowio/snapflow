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
import { SandboxLifecycle } from '@snapflow/machine-proto';
import { BillingRestrictedException } from '../../../billing/exceptions/billing-restricted.exception';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import type { Machine } from '../../../machine/entities/machine.entity';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import { NoAvailableMachineError } from '../../../placement/exceptions/no-available-machine.exception';
import { MachineReservationService } from '../../../placement/services/machine-reservation.service';
import { sandboxSchedulingParameters } from '../../../placement/utils/sandbox-scheduling.util';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import {
	DRAINING_MIGRATION_LOCK_TTL_SECONDS,
	DRAINING_SANDBOX_LOCK_TTL_SECONDS,
} from '../../constants/draining-machine.constants';
import { SANDBOX_WORKER_LIMITS } from '../../constants/sandbox.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { getStateChangeLockKey } from '../../utils/lock-key.util';
import { deletesImmediatelyOnStop } from '../../utils/runtime/ephemeral.util';
import { SandboxRuntimeSpecService } from '../sandbox/sandbox-runtime-spec.service';

@Injectable()
export class DrainingMachineEvictionService {
	private readonly logger = new Logger(DrainingMachineEvictionService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly machineReservations: MachineReservationService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly runtimeSpecs: SandboxRuntimeSpecService
	) {}

	async migrateStoppedSandboxes(machine: Machine): Promise<void> {
		const sandboxes = await this.entityManager.find(
			Sandbox,
			{
				machineId: machine.id,
				placementKind: PlacementKind.FLEXIBLE,
				state: SandboxState.STOPPED,
				desiredState: SandboxDesiredState.STOPPED,
				pending: false,
				backupState: BackupState.COMPLETED,
				backupSnapshot: { $ne: null },
			},
			{ limit: SANDBOX_WORKER_LIMITS.drainingSandboxBatchSize }
		);

		await settleSequentially(sandboxes, (sandbox) =>
			this.redisLockProvider.runExclusive(
				getStateChangeLockKey(sandbox.id),
				DRAINING_MIGRATION_LOCK_TTL_SECONDS,
				async () => {
					try {
						await this.migrateSandbox(sandbox, machine.id);
					} catch (error) {
						this.logger.error(
							`Error migrating sandbox ${sandbox.id} from draining machine ${machine.id}`,
							error
						);
					}
				}
			)
		);
	}

	private async migrateSandbox(
		sandbox: Sandbox,
		drainingMachineId: string
	): Promise<void> {
		const backupSnapshot = sandbox.backupSnapshot;
		if (!backupSnapshot) {
			throw new Error(`Sandbox ${sandbox.id} has no completed backup artifact`);
		}
		const parameters = {
			...sandboxSchedulingParameters(sandbox),
			snapshotRef: backupSnapshot,
			excludedMachineIds: [drainingMachineId],
		};
		let migrating: Sandbox;
		try {
			migrating = await this.sandboxRepository.update(sandbox.id, {
				entity: sandbox,
				updateData: {
					state: SandboxState.RESTORING,
					prevMachineId: drainingMachineId,
				},
				reserveMachine: (manager, coLockedMachineIds) =>
					this.machineReservations.reserveAvailable(
						manager,
						parameters,
						coLockedMachineIds
					),
				runtimeIntent: (machineId) =>
					this.runtimeSpecs.backupIntent(
						sandbox,
						machineId,
						SandboxLifecycle.STOPPED
					),
			});
		} catch (error) {
			if (
				error instanceof NoAvailableMachineError ||
				error instanceof BillingRestrictedException
			) {
				this.logger.debug(
					`Backup ${backupSnapshot} of sandbox ${sandbox.id} cannot move yet (${error.message}); migration deferred`
				);
				return;
			}
			throw error;
		}

		this.logger.log(
			`Migrating sandbox ${sandbox.id} from draining machine ${drainingMachineId} to machine ${migrating.machineId}`
		);
	}

	async forceStopStartedSandboxes(machineId: string): Promise<void> {
		const sandboxes = await this.entityManager.find(
			Sandbox,
			{
				machineId,
				state: SandboxState.STARTED,
				desiredState: SandboxDesiredState.STARTED,
				pending: false,
			},
			{ limit: SANDBOX_WORKER_LIMITS.drainingSandboxBatchSize }
		);

		await settleSequentially(sandboxes, async (sandbox) => {
			try {
				await this.redisLockProvider.runExclusive(
					getStateChangeLockKey(sandbox.id),
					DRAINING_SANDBOX_LOCK_TTL_SECONDS,
					() => this.requestStop(sandbox)
				);
			} catch (error) {
				this.logger.error(
					`Failed to request stop for sandbox ${sandbox.id} on draining machine ${machineId}`,
					error
				);
			}
		});
	}

	private async requestStop(sandbox: Sandbox): Promise<void> {
		const updateData: Partial<Sandbox> = deletesImmediatelyOnStop(sandbox)
			? Sandbox.getSoftDeleteUpdate(sandbox)
			: { pending: true, desiredState: SandboxDesiredState.STOPPED };
		await this.sandboxRepository.updateWhere(sandbox.id, {
			updateData,
			whereCondition: { pending: false, state: SandboxState.STARTED },
		});
	}

	async archiveStoppedSandboxes(machineId: string): Promise<void> {
		const sandboxes = await this.entityManager.find(
			Sandbox,
			{
				machineId,
				state: SandboxState.STOPPED,
				desiredState: SandboxDesiredState.STOPPED,
				backupState: BackupState.COMPLETED,
				backupSnapshot: { $ne: null },
				pending: false,
			},
			{ limit: SANDBOX_WORKER_LIMITS.drainingSandboxBatchSize }
		);

		await settleSequentially(sandboxes, (sandbox) =>
			this.redisLockProvider.runExclusive(
				getStateChangeLockKey(sandbox.id),
				DRAINING_SANDBOX_LOCK_TTL_SECONDS,
				async () => {
					try {
						await this.sandboxRepository.updateWhere(sandbox.id, {
							updateData: { desiredState: SandboxDesiredState.ARCHIVED },
							whereCondition: { pending: false, state: SandboxState.STOPPED },
						});
					} catch (error) {
						this.logger.error(
							`Failed to request archive for sandbox ${sandbox.id} on draining machine ${machineId}`,
							error
						);
					}
				}
			)
		);
	}

	async archiveErroredSandboxes(machineId: string): Promise<void> {
		const sandboxes = await this.entityManager.find(
			Sandbox,
			{
				machineId,
				state: SandboxState.ERROR,
				recoverable: false,
				desiredState: {
					$nin: [SandboxDesiredState.DESTROYED, SandboxDesiredState.ARCHIVED],
				},
				backupState: BackupState.COMPLETED,
				backupSnapshot: { $ne: null },
			},
			{ limit: SANDBOX_WORKER_LIMITS.drainingSandboxBatchSize }
		);

		await settleSequentially(sandboxes, (sandbox) =>
			this.redisLockProvider.runExclusive(
				getStateChangeLockKey(sandbox.id),
				DRAINING_SANDBOX_LOCK_TTL_SECONDS,
				async () => {
					try {
						this.logger.warn(
							`Setting desired state to ARCHIVED for errored sandbox ${sandbox.id} on draining machine ${machineId} (previous desired state: ${sandbox.desiredState})`
						);
						await this.sandboxRepository.updateWhere(sandbox.id, {
							updateData: { desiredState: SandboxDesiredState.ARCHIVED },
							whereCondition: { state: SandboxState.ERROR },
						});
					} catch (error) {
						this.logger.error(
							`Failed to set desired state to ARCHIVED for errored sandbox ${sandbox.id} on draining machine ${machineId}`,
							error
						);
					}
				}
			)
		);
	}
}
