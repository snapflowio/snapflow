/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../../common/utils/error/database-error.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { MachineMarketplaceService } from '../../marketplace/services/machine-marketplace.service';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import type {
	MachineRegistrationDto,
	RegisterMachineDto,
} from '../dto/machine-registration.dto';
import { Machine } from '../entities/machine.entity';
import { MachineState } from '../enums/machine-state.enum';
import {
	assertMachineRegistrationProof,
	type MachineIdentity,
	parseMachineIdentity,
} from '../utils/machine-identity.util';
import { MachineAdministrationService } from './machine-administration.service';
import { MachineLocationService } from './machine-location.service';

interface RegistrationRequest {
	organizationId: string;
	name: string;
	appVersion: string | null;
	identity: MachineIdentity;
	address: string | undefined;
}

@Injectable()
export class MachineRegistrationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineAdministration: MachineAdministrationService,
		private readonly marketplace: MachineMarketplaceService,
		private readonly machineLocation: MachineLocationService
	) {}

	async register(
		organizationId: string,
		input: RegisterMachineDto,
		address: string | undefined
	): Promise<MachineRegistrationDto> {
		const identity = parseMachineIdentity(input.identityPublicKey);
		const name = input.name.trim();
		assertMachineRegistrationProof(
			identity,
			{ ...input, name },
			await databaseNow(this.entityManager)
		);
		const machine = await this.registerMachine({
			organizationId,
			name,
			appVersion: input.appVersion ?? null,
			identity,
			address,
		});
		return { machineId: machine.id, ownerId: organizationId };
	}

	private async registerMachine(
		request: RegistrationRequest
	): Promise<Machine> {
		try {
			return await this.entityManager.transactional(
				(manager) => this.bindIdentity(manager, request),
				{ propagation: TransactionPropagation.REQUIRED }
			);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictException(
					'This machine identity is being registered concurrently',
					{ cause: error }
				);
			}
			throw error;
		}
	}

	private async bindIdentity(
		manager: EntityManager,
		request: RegistrationRequest
	): Promise<Machine> {
		const registered = await manager.findOne(
			Machine,
			{ identityKeyId: request.identity.keyId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (registered) return this.assertSameRegistration(registered, request);

		const named = await manager.findOne(
			Machine,
			{ organizationId: request.organizationId, name: request.name },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (named?.identityKeyId) {
			throw new ConflictException(
				'A machine with this name is already registered in this organization'
			);
		}
		const machine = named
			? resetForRegistration(named, request.appVersion)
			: await this.machineAdministration.create(
					{
						organizationId: request.organizationId,
						name: request.name,
						appVersion: request.appVersion ?? undefined,
						sandboxClass: SandboxClass.LINUX_VM,
					},
					manager
				);
		machine.identityPublicKey = request.identity.publicKeyPem;
		machine.identityKeyId = request.identity.keyId;
		machine.identityKeyRegisteredAt = await databaseNow(manager);
		this.machineLocation.locate(machine, request.address);
		await this.marketplace.ensureListing(manager, machine.id);
		return machine;
	}

	private assertSameRegistration(
		machine: Machine,
		request: RegistrationRequest
	): Machine {
		if (machine.organizationId !== request.organizationId) {
			throw new ConflictException(
				'This machine identity is registered to another organization'
			);
		}
		if (machine.name !== request.name) {
			throw new ConflictException(
				`This machine identity is already registered as ${machine.name}`
			);
		}
		return machine;
	}
}

function resetForRegistration(
	machine: Machine,
	appVersion: string | null
): Machine {
	machine.state = MachineState.INITIALIZING;
	machine.unschedulable = false;
	machine.draining = false;
	machine.readinessReason = null;
	machine.appVersion = appVersion;
	machine.sshHostPublicKey = null;
	machine.serviceHealth = null;
	machine.runtimeCapabilities = null;
	machine.updateStatus = null;
	machine.lastChecked = null;
	machine.sessionExpiresAt = null;
	return machine;
}
