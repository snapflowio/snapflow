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
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { errorDetail } from '../../../common/utils/error/error.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { Sandbox } from '../../instance/entities/sandbox.entity';
import { SandboxPlacement } from '../../instance/entities/sandbox-placement.entity';
import { SandboxState } from '../../instance/enums/sandbox-state.enum';
import {
	JOB_MACHINE_API_VERSION,
	MACHINE_IDENTITY_REVOKED_REASON,
} from '../constants/machine.constants';
import { MachineEvents } from '../constants/machine-events.constants';
import {
	MACHINE_NAME_MAX_LENGTH,
	MACHINE_NAME_MIN_LENGTH,
	MACHINE_NAME_REGEX,
} from '../constants/machine-name-regex.constants';
import { CreateMachineInternalDto } from '../dto/create-machine-internal.dto';
import type { MachineUpdateStatusDto } from '../dto/machine-update-status.dto';
import { Machine } from '../entities/machine.entity';
import { MachineSession } from '../entities/machine-session.entity';
import { MachineState } from '../enums/machine-state.enum';
import { MachineDeletedEvent } from '../events/machine-deleted.event';
import { lockMachineForUpdate } from '../utils/machine-lock.util';
import { MachineService } from './machine.service';

function assertValidMachineName(name: string): void {
	if (!MACHINE_NAME_REGEX.test(name)) {
		throw new BadRequestException(
			'Machine name must contain only letters, numbers, underscores, periods, and hyphens'
		);
	}
	if (
		name.length < MACHINE_NAME_MIN_LENGTH ||
		name.length > MACHINE_NAME_MAX_LENGTH
	) {
		throw new BadRequestException(
			`Machine name must be between ${MACHINE_NAME_MIN_LENGTH} and ${MACHINE_NAME_MAX_LENGTH} characters`
		);
	}
}

@Injectable()
export class MachineAdministrationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machines: MachineService,
		@Inject(EventEmitter2)
		private eventEmitter: EventEmitter2
	) {}

	async create(
		createMachineDto: CreateMachineInternalDto,
		manager?: EntityManager
	): Promise<Machine> {
		assertValidMachineName(createMachineDto.name);
		const machine = new Machine({
			organizationId: createMachineDto.organizationId,
			name: createMachineDto.name,
			apiVersion: JOB_MACHINE_API_VERSION,
			appVersion: createMachineDto.appVersion,
			sandboxClass: createMachineDto.sandboxClass,
		});

		try {
			const entityManager = manager ?? this.entityManager;
			entityManager.persist(machine);
			await entityManager.flush();
			return machine;
		} catch (error) {
			if (isUniqueViolation(error)) {
				if (errorDetail(error)?.includes('name')) {
					throw new ConflictException(
						`Machine with name ${createMachineDto.name} already exists in this organization`
					);
				}
				throw new ConflictException(
					'A machine with these values already exists'
				);
			}
			throw error;
		}
	}

	async revokeIdentity(id: string): Promise<void> {
		await this.entityManager.transactional(async (manager) => {
			const machine = await lockMachineForUpdate(manager, id);
			if (!machine) throw new NotFoundException('Machine not found');
			if (
				machine.identityPublicKey === null &&
				machine.identityKeyId === null &&
				machine.state === MachineState.DISABLED &&
				machine.readinessReason === MACHINE_IDENTITY_REVOKED_REASON
			) {
				return;
			}
			const now = await databaseNow(manager);
			machine.identityPublicKey = null;
			machine.identityKeyId = null;
			machine.identityKeyRegisteredAt = null;
			machine.unschedulable = true;
			machine.draining = true;
			machine.state = MachineState.DISABLED;
			machine.readinessReason = MACHINE_IDENTITY_REVOKED_REASON;
			machine.sshHostPublicKey = null;
			machine.serviceHealth = null;
			machine.runtimeCapabilities = null;
			machine.updateStatus = null;
			machine.lastChecked = null;
			machine.sessionGeneration += 1;
			machine.sessionExpiresAt = null;
			await manager.nativeUpdate(
				MachineSession,
				{ machineId: id, revokedAt: null },
				{ revokedAt: now, updatedAt: now }
			);
		});
	}

	async remove(id: string): Promise<void> {
		const machine = await this.machines.findOne(id);
		if (!machine) {
			throw new NotFoundException('Machine not found');
		}

		if (!machine.unschedulable) {
			throw new BadRequestException(
				'Cannot delete machine which is available for scheduling sandboxes'
			);
		}

		const sandbox = await this.entityManager.findOne(
			Sandbox,
			{
				machineId: id,
				state: { $nin: [SandboxState.ARCHIVED, SandboxState.DESTROYED] },
			},
			{ fields: ['id'], disableIdentityMap: true }
		);
		if (sandbox) {
			throw new BadRequestException(
				'Cannot delete machine which has sandboxes associated with it'
			);
		}

		const hasAuditHistory = Boolean(
			await this.entityManager.findOne(
				SandboxPlacement,
				{ machineId: id },
				{ fields: ['id'], disableIdentityMap: true }
			)
		);
		if (hasAuditHistory) {
			throw new BadRequestException(
				'Cannot delete machine with immutable placement or usage history; decommission it instead'
			);
		}

		await this.entityManager.transactional(async (em) => {
			await em.nativeDelete(Machine, { id });
			await this.eventEmitter.emitAsync(
				MachineEvents.DELETED,
				new MachineDeletedEvent(em, id)
			);
		});
	}

	async updateSchedulingStatus(
		id: string,
		unschedulable: boolean
	): Promise<Machine> {
		const machine = await this.machines.findOneOrFail(id);
		machine.unschedulable = unschedulable;
		await this.entityManager.flush();
		return machine;
	}

	async updateDrainingStatus(id: string, draining: boolean): Promise<Machine> {
		const machine = await this.machines.findOneOrFail(id);
		machine.draining = draining;
		await this.entityManager.flush();
		return machine;
	}

	async requestUpdateDrain(id: string): Promise<Machine> {
		const machine = await this.machines.findOneOrFail(id);
		machine.unschedulable = true;
		machine.draining = true;
		await this.entityManager.flush();
		return machine;
	}

	async reportUpdateStatus(
		id: string,
		status: MachineUpdateStatusDto
	): Promise<Machine> {
		const machine = await this.machines.findOneOrFail(id);
		machine.updateStatus = status;
		await this.entityManager.flush();
		return machine;
	}

	async decommission(id: string): Promise<void> {
		await this.revokeIdentity(id);
		const machine = await this.machines.findOneOrFail(id);
		machine.state = MachineState.DECOMMISSIONED;
		await this.entityManager.flush();
	}
}
