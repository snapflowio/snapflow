/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import { MachineService } from '../../../machine/services/machine.service';
import { MachineJobDispatchService } from '../../../machine-job/services/machine-job-dispatch.service';
import { OrganizationService } from '../../../organization/services/organization.service';
import { CreateSandboxSnapshotDto } from '../../../snapshot/dto/create-sandbox-snapshot.dto';
import { SnapshotQuotaService } from '../../../snapshot/services/snapshot-quota.service';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxBackupCreatedEvent } from '../../events/sandbox-backup-created.event';
import { StateChangeInProgressException } from '../../exceptions/state-change-in-progress.exception';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { isEphemeral } from '../../utils/runtime/ephemeral.util';
import { SandboxService } from '../sandbox/sandbox.service';

const CAPTURED_SNAPSHOT_COUNT = 1;
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
			throw new BadRequestException('Ephemeral sandboxes cannot be backed up');
		}
		if (
			sandbox.state !== SandboxState.STARTED &&
			sandbox.state !== SandboxState.STOPPED
		) {
			throw new BadRequestException(
				'Sandbox must be in started or stopped state to create a backup'
			);
		}
		if (sandbox.pending) {
			throw new StateChangeInProgressException();
		}

		if (!BACKUP_IDLE_STATES.includes(sandbox.backupState)) {
			throw new BadRequestException('Sandbox backup is already in progress');
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
			if (sandbox.state !== SandboxState.STOPPED) {
				throw new BadRequestException(
					'Sandbox must be stopped to create a portable OCI snapshot'
				);
			}

			if (sandbox.pending) {
				throw new StateChangeInProgressException();
			}

			if (!sandbox.machineId) {
				throw new NotFoundException(
					`Sandbox with ID ${sandbox.id} does not have a machine`
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
				CAPTURED_SNAPSHOT_COUNT,
				{
					cpu: sandbox.cpu,
					memory: sandbox.mem,
					disk: sandbox.disk,
					gpu: sandbox.gpu,
				}
			);
			pendingSnapshotCountIncrement = CAPTURED_SNAPSHOT_COUNT;

			const updatedSandbox = await this.sandboxRepository.updateWhere(
				sandbox.id,
				{
					updateData: {
						state: SandboxState.SNAPSHOTTING,
						pending: true,
					},
					whereCondition: {
						state: sandbox.state,
						pending: false,
					},
				}
			);

			try {
				await this.machineJobDispatch.createSnapshotFromSandbox(
					machine,
					sandbox.id,
					dto.name,
					registry
				);
			} catch (error) {
				await this.sandboxRepository.updateWhere(sandbox.id, {
					updateData: {
						state: sandbox.state,
						pending: false,
					},
					whereCondition: { state: SandboxState.SNAPSHOTTING },
				});

				throw error;
			}

			return updatedSandbox;
		} catch (error) {
			await this.snapshotQuota.release(
				organizationId,
				pendingSnapshotCountIncrement
			);
			throw error;
		}
	}
}
