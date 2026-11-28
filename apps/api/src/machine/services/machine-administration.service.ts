/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { apiError } from '../../common/utils/error/api-error.util';
import { isUniqueViolation } from '../../common/utils/error/database-error.util';
import { errorDetail } from '../../common/utils/error/error.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import { ListingState } from '../../marketplace/enums/listing-state.enum';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
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
import { MachineApiErrorCode } from '../enums/machine-api-error-code.enum';
import { MachineState } from '../enums/machine-state.enum';
import { MachineDeletedEvent } from '../events/machine-deleted.event';
import { MachineNotFoundException } from '../exceptions/machine-not-found.exception';
import { lockMachineForUpdate } from '../utils/machine-lock.util';
import { MachineService } from './machine.service';

function assertValidMachineName(name: string): void {
	if (!MACHINE_NAME_REGEX.test(name)) {
		throw new BadRequestException(
			apiError(
				MachineApiErrorCode.NAME_INVALID,
				'The machine name may contain only letters, numbers, underscores, periods and hyphens. Choose another name.'
			)
		);
	}
	if (
		name.length < MACHINE_NAME_MIN_LENGTH ||
		name.length > MACHINE_NAME_MAX_LENGTH
	) {
		throw new BadRequestException(
			apiError(
				MachineApiErrorCode.NAME_INVALID,
				`The machine name must be ${MACHINE_NAME_MIN_LENGTH} to ${MACHINE_NAME_MAX_LENGTH} characters long. Choose another name.`
			)
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
						apiError(
							MachineApiErrorCode.NAME_TAKEN,
							`A machine named ${createMachineDto.name} already exists in this organization. Choose another name.`
						)
					);
				}
				throw new ConflictException(
					apiError(
						MachineApiErrorCode.IDENTITY_REGISTERED,
						'This machine is already registered. Use the existing machine instead.'
					)
				);
			}
			throw error;
		}
	}

	async revokeIdentity(id: string): Promise<void> {
		await this.entityManager.transactional(async (manager) => {
			const machine = await lockMachineForUpdate(manager, id);
			if (!machine) throw new MachineNotFoundException();
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
			throw new MachineNotFoundException();
		}

		if (!machine.unschedulable) {
			throw new BadRequestException(
				apiError(
					MachineApiErrorCode.DELETE_BLOCKED,
					'The machine still accepts sandboxes. Mark it unschedulable, then delete it.'
				)
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
				apiError(
					MachineApiErrorCode.DELETE_BLOCKED,
					'The machine still has sandboxes. Move or delete them, then delete the machine.'
				)
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
				apiError(
					MachineApiErrorCode.DELETE_BLOCKED,
					'The machine has billing history and cannot be deleted. Decommission it instead.'
				)
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
		if (!draining) machine.withdrawnAt = null;
		await this.entityManager.flush();
		return machine;
	}

	async withdraw(id: string): Promise<Machine> {
		return this.entityManager.transactional(async (manager) => {
			const machine = await lockMachineForUpdate(manager, id);
			if (!machine) throw new MachineNotFoundException();
			machine.unschedulable = true;
			machine.draining = true;
			machine.withdrawnAt ??= await databaseNow(manager);
			machine.listedSince = null;
			const listing = await manager.findOne(
				MachineListing,
				{ machineId: id, state: ListingState.LISTED },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (listing) listing.state = ListingState.PAUSED;
			return machine;
		});
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
