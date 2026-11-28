/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { type Address, getAddress } from 'viem';
import { apiError } from '../../../common/utils/error/api-error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { MachineMarketplaceService } from '../../../marketplace/services/machine-marketplace.service';
import { SandboxClass } from '../../../sandbox/enums/sandbox-class.enum';
import { EscrowAttributionService } from '../../../settlement/services/escrow/escrow-attribution.service';
import { MachineEnrollmentErrorCode } from '../../constants/machine-enrollment.constants';
import type {
	MachineEnrollmentDto,
	MachineEnrollmentProofDto,
} from '../../dto/machine-enrollment.dto';
import { Machine } from '../../entities/machine.entity';
import { MachineHostKey } from '../../entities/machine-host-key.entity';
import { MachineApiErrorCode } from '../../enums/machine-api-error-code.enum';
import { MachineState } from '../../enums/machine-state.enum';
import {
	assertMachineEnrollmentProof,
	type MachineIdentity,
	parseMachineIdentity,
} from '../../utils/machine-identity.util';
import { MachineAdministrationService } from '../machine-administration.service';
import { MachineLocationService } from './machine-location.service';

interface VerifiedMachineEnrollment {
	identity: MachineIdentity;
	name: string;
	hostAddress: Address;
	appVersion: string | null;
}

interface RegistrationRequest extends VerifiedMachineEnrollment {
	organizationId: string;
	enrollmentKeyId: string | null;
	address: string | undefined;
}

@Injectable()
export class MachineRegistrationService {
	constructor(
		private readonly config: TypedConfigService,
		private readonly machineAdministration: MachineAdministrationService,
		private readonly marketplace: MachineMarketplaceService,
		private readonly machineLocation: MachineLocationService,
		private readonly attribution: EscrowAttributionService
	) {}

	async checkProof(
		manager: EntityManager,
		input: MachineEnrollmentProofDto
	): Promise<VerifiedMachineEnrollment> {
		const identity = parseMachineIdentity(input.identityPublicKey);
		const name = input.name.trim();
		const hostAddress = getAddress(input.hostAddress);
		await assertMachineEnrollmentProof(
			identity,
			this.config.get('settlement.chainId'),
			{ ...input, name, hostAddress },
			await databaseNow(manager)
		);
		return {
			identity,
			name,
			hostAddress,
			appVersion: input.appVersion ?? null,
		};
	}

	async register(
		manager: EntityManager,
		request: RegistrationRequest
	): Promise<MachineEnrollmentDto> {
		const machine = await this.bindIdentity(manager, request);
		machine.enrollmentKeyId = request.enrollmentKeyId;
		await this.bindHostKey(manager, machine, request.hostAddress);
		return {
			machineId: machine.id,
			organizationId: machine.organizationId,
			hostAddress: request.hostAddress,
		};
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
		if (registered) return assertSameRegistration(registered, request);

		const named = await manager.findOne(
			Machine,
			{ organizationId: request.organizationId, name: request.name },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (named?.identityKeyId) {
			throw new ConflictException(
				apiError(
					MachineApiErrorCode.NAME_TAKEN,
					'A machine with this name is already registered in this organization. Choose another name.'
				)
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

	private async bindHostKey(
		manager: EntityManager,
		machine: Pick<Machine, 'id' | 'organizationId'>,
		address: Address
	): Promise<void> {
		const machineId = machine.id;
		const existing = await manager.findOne(MachineHostKey, { address });
		if (existing) {
			if (existing.machineId === machineId && existing.retiredAt === null) {
				return;
			}
			throw new ConflictException({
				code: MachineEnrollmentErrorCode.HOST_KEY_IN_USE,
				message: 'This host key is already registered; generate a new one',
			});
		}
		const now = await databaseNow(manager);
		await manager.nativeUpdate(
			MachineHostKey,
			{ machineId, retiredAt: null },
			{ retiredAt: now }
		);
		manager.create(MachineHostKey, {
			machineId,
			address,
			registeredAt: now,
			retiredAt: null,
		});
		await manager.flush();
		await this.attribution.attributeHostKey(
			manager,
			machine.organizationId,
			address
		);
	}
}

function assertSameRegistration(
	machine: Machine,
	request: RegistrationRequest
): Machine {
	if (machine.organizationId !== request.organizationId) {
		throw new ConflictException(
			apiError(
				MachineApiErrorCode.IDENTITY_REGISTERED,
				'This machine is registered to another organization. Remove it there first, or enroll it with that organization.'
			)
		);
	}
	if (machine.name !== request.name) {
		throw new ConflictException(
			apiError(
				MachineApiErrorCode.IDENTITY_REGISTERED,
				`This machine is already registered as ${machine.name}. Use the existing machine instead.`
			)
		);
	}
	return machine;
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
