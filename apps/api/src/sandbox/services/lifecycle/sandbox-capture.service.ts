/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommonErrorCode } from '../../../common/enums/common-error-code.enum';
import { apiError } from '../../../common/utils/error/api-error.util';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import { MachineService } from '../../../machine/services/machine.service';
import { MachineJobDispatchService } from '../../../machine-job/services/machine-job-dispatch.service';
import { OrganizationService } from '../../../organization/services/organization.service';
import { SNAPSHOT_CAPTURE } from '../../../snapshot/constants/snapshot-capture.constants';
import { CreateSandboxSnapshotDto } from '../../../snapshot/dto/create-sandbox-snapshot.dto';
import { SnapshotRepository } from '../../../snapshot/repositories/snapshot.repository';
import { SnapshotQuotaService } from '../../../snapshot/services/snapshot-quota.service';
import { newCapturedSnapshot } from '../../../snapshot/utils/captured-snapshot.util';
import { persistUniquelyNamed } from '../../../snapshot/utils/unique-snapshot-name.util';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxBackupCreatedEvent } from '../../events/sandbox-backup-created.event';
import { StateChangeInProgressException } from '../../exceptions/state-change-in-progress.exception';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { isEphemeral } from '../../utils/runtime/ephemeral.util';
import { assertSandboxCopyAllowed } from '../../utils/state/abuse-hold.util';
import { SandboxService } from '../sandbox/sandbox.service';

const BACKUP_IDLE_STATES: readonly BackupState[] = [
	BackupState.COMPLETED,
	BackupState.NONE,
];

@Injectable()
export class SandboxCaptureService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxService: SandboxService,
		private readonly sandboxRepository: SandboxRepository,
		private readonly machineService: MachineService,
		private readonly machineJobDispatch: MachineJobDispatchService,
		private readonly organizations: OrganizationService,
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly snapshotQuota: SnapshotQuotaService,
		private readonly snapshotRepository: SnapshotRepository,
		private readonly eventEmitter: EventEmitter2
	) {}

	async createBackup(
		sandboxIdOrName: string,
		organizationId: string
	): Promise<Sandbox> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);

		if (isEphemeral(sandbox)) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.MODE_INVALID,
					'Ephemeral sandboxes cannot be backed up. Use a standard sandbox to keep backups.'
				)
			);
		}
		if (
			sandbox.state !== SandboxState.STARTED &&
			sandbox.state !== SandboxState.STOPPED
		) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.STATE_INVALID,
					'A backup needs a started or stopped sandbox. Wait for the sandbox to start or stop, then try again.'
				)
			);
		}
		if (sandbox.pending) {
			throw new StateChangeInProgressException();
		}

		if (!BACKUP_IDLE_STATES.includes(sandbox.backupState)) {
			throw new BadRequestException(
				apiError(
					CommonErrorCode.OPERATION_IN_PROGRESS,
					'A backup of this sandbox is already running. Wait for it to finish.'
				)
			);
		}

		await this.eventEmitter.emitAsync(
			SandboxEvents.BACKUP_CREATED,
			new SandboxBackupCreatedEvent(sandbox)
		);

		return this.entityManager.findOneOrFail(
			Sandbox,
			{ id: sandbox.id },
			{ refresh: true }
		);
	}

	async createSnapshotFromSandbox(
		sandboxIdOrName: string,
		organizationId: string,
		dto: CreateSandboxSnapshotDto
	): Promise<Sandbox> {
		let pendingSnapshotCountIncrement: number | undefined;

		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);

		try {
			assertSandboxCopyAllowed(sandbox);
			if (sandbox.state !== SandboxState.STOPPED) {
				throw new BadRequestException(
					apiError(
						SandboxErrorCode.STATE_INVALID,
						'The sandbox must be stopped to create a snapshot from it. Stop the sandbox, then try again.'
					)
				);
			}

			if (sandbox.pending) {
				throw new StateChangeInProgressException();
			}

			if (!sandbox.machineId) {
				throw new NotFoundException(
					apiError(
						SandboxErrorCode.NOT_PLACED,
						`Sandbox ${sandbox.id} is not placed on a machine. Start the sandbox, then try again.`
					)
				);
			}

			const machine = await this.machineService.findOneOrFail(
				sandbox.machineId
			);

			await this.organizations.assertActive(organizationId);

			const registry =
				this.dockerRegistryService.getAvailableInternalRegistry();

			await this.snapshotQuota.reserve(
				organizationId,
				sandbox.sandboxClass,
				SNAPSHOT_CAPTURE.COUNT,
				{
					cpu: sandbox.cpu,
					memory: sandbox.mem,
					disk: sandbox.disk,
					gpu: sandbox.gpu,
				}
			);
			pendingSnapshotCountIncrement = SNAPSHOT_CAPTURE.COUNT;

			return await persistUniquelyNamed(dto.name, () =>
				this.entityManager.transactional(
					async (manager) => {
						const { snapshot, reference } = newCapturedSnapshot(
							manager,
							sandbox,
							dto.name,
							registry
						);
						await this.snapshotRepository.insert(snapshot);
						const capturing = await this.sandboxRepository.updateWhere(
							sandbox.id,
							{
								updateData: { state: SandboxState.SNAPSHOTTING, pending: true },
								whereCondition: { state: sandbox.state, pending: false },
							}
						);
						await this.machineJobDispatch.createSnapshotFromSandbox(
							machine,
							sandbox.id,
							reference,
							registry
						);
						return capturing;
					},
					{ propagation: TransactionPropagation.REQUIRED }
				)
			);
		} catch (error) {
			await this.snapshotQuota.release(
				organizationId,
				pendingSnapshotCountIncrement
			);
			throw error;
		}
	}
}
