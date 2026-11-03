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
	ConflictException,
	ForbiddenException,
	GatewayTimeoutException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { millisecondsBetween } from '../../../common/utils/time.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SandboxService } from '../../../sandbox/instance/services/sandbox/sandbox.service';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import {
	EXPOSURE_BACKEND_STATE,
	SYSTEM_EXPOSURE_LEASE,
	SYSTEM_EXPOSURE_SERVICE,
} from '../constants/exposure.constants';
import type { MachineSshAccessDto, SshRelayDto } from '../dto/ssh-relay.dto';
import { Edge } from '../entities/edge.entity';
import { ExposureBackend } from '../entities/exposure-backend.entity';
import { SystemExposureLeaseService } from './exposure/system-exposure-lease.service';

const SSH_RELAY_ACTIVATION_TIMEOUT_MILLISECONDS = 30_000;
const SSH_RELAY_ACTIVATION_POLL_MILLISECONDS = 250;

@Injectable()
export class SshRelayService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxes: SandboxService,
		private readonly systemExposures: SystemExposureLeaseService
	) {}

	async resolve(token: string): Promise<SshRelayDto> {
		const access = await this.sandboxes.validateSshAccess(token);
		if (!access.valid) {
			throw new UnauthorizedException('SSH access grant is invalid or expired');
		}
		const remainingSeconds = Math.ceil(
			millisecondsBetween(new Date(), access.expiresAt) /
				MILLISECONDS_PER_SECOND
		);
		const durationSeconds = Math.min(
			SYSTEM_EXPOSURE_LEASE.maximumDurationSeconds,
			Math.max(SYSTEM_EXPOSURE_LEASE.minimumDurationSeconds, remainingSeconds)
		);
		const exposure = await this.systemExposures.request(
			access.organizationId,
			access.sandboxId,
			SYSTEM_EXPOSURE_SERVICE.SSH,
			durationSeconds
		);
		const observedAt = await databaseNow(this.entityManager);
		const backend = await this.entityManager.findOne(
			ExposureBackend,
			{
				exposureId: exposure.id,
				exposureGeneration: exposure.generation,
				state: EXPOSURE_BACKEND_STATE.ACTIVE,
				leaseExpiresAt: { $gt: observedAt },
			},
			{ orderBy: { activatedAt: 'DESC' } }
		);
		const edge = backend
			? await this.entityManager.findOne(Edge, { id: backend.edgeId })
			: null;
		const machine = backend
			? await this.entityManager.findOne(Machine, { id: backend.machineId })
			: null;
		if (
			!backend ||
			!edge ||
			!backend.publicPort ||
			!machine?.sshHostPublicKey
		) {
			throw new ConflictException('SSH Edge relay is still activating');
		}
		return {
			sandboxId: access.sandboxId,
			machineId: backend.machineId,
			host: edge.publicHost,
			port: backend.publicPort,
			machineHostPublicKey: machine.sshHostPublicKey,
			expiresAt: access.expiresAt.toISOString(),
		};
	}

	async waitForActive(token: string): Promise<SshRelayDto> {
		const deadline = Date.now() + SSH_RELAY_ACTIVATION_TIMEOUT_MILLISECONDS;
		while (true) {
			try {
				return await this.resolve(token);
			} catch (error) {
				if (!(error instanceof ConflictException) || Date.now() >= deadline) {
					if (error instanceof ConflictException) {
						throw new GatewayTimeoutException(
							'SSH Edge relay did not activate before the deadline'
						);
					}
					throw error;
				}
			}
			await new Promise((resolve) =>
				setTimeout(resolve, SSH_RELAY_ACTIVATION_POLL_MILLISECONDS)
			);
		}
	}

	async resolveForMachine(
		token: string,
		machineId: string
	): Promise<MachineSshAccessDto> {
		const relay = await this.resolve(token);
		if (relay.machineId !== machineId) {
			throw new ForbiddenException(
				'SSH access grant is assigned to a different machine'
			);
		}
		return { sandboxId: relay.sandboxId };
	}
}
