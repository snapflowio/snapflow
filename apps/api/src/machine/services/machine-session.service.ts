/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, randomBytes } from 'node:crypto';
import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { v4 } from 'uuid';
import { addMilliseconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { observeOperation } from '../../infra/logging/utils/operation-observability.util';
import {
	MACHINE_AUTHORIZATION_SCHEME,
	MACHINE_SESSION_DURATION_MS,
	MACHINE_SESSION_TOKEN_BYTES,
	MACHINE_SESSION_TOKEN_HASH_ALGORITHM,
} from '../constants/machine-session.constants';
import {
	MachineSessionDto,
	RenewMachineSessionDto,
} from '../dto/machine-session.dto';
import { Machine } from '../entities/machine.entity';
import { MachineSession } from '../entities/machine-session.entity';
import { MachineState } from '../enums/machine-state.enum';
import { lockMachineForUpdate } from '../utils/machine-lock.util';
import { MachineLocationService } from './machine-location.service';
import { MachineProofService } from './machine-proof.service';

@Injectable()
export class MachineSessionService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineProofService: MachineProofService,
		private readonly machineLocation: MachineLocationService
	) {}

	async create(
		machineId: string,
		request: Request
	): Promise<MachineSessionDto> {
		return this.entityManager.transactional(
			async (manager) => {
				const machine = await lockMachineForUpdate(manager, machineId);
				if (!machine) throw new ForbiddenException('Machine is not active');

				const now = await databaseNow(manager);
				await this.machineProofService.verify(request, machine);
				this.machineLocation.locate(machine, request.ip);
				await manager.nativeUpdate(
					MachineSession,
					{ machineId, revokedAt: null },
					{ revokedAt: now, updatedAt: now }
				);

				machine.sessionGeneration += 1;
				machine.state = MachineState.INITIALIZING;
				machine.readinessReason = null;
				const expiresAt = addMilliseconds(now, MACHINE_SESSION_DURATION_MS);
				machine.sessionExpiresAt = expiresAt;
				this.advanceTunnelPlan(machine, now);

				const token = randomBytes(MACHINE_SESSION_TOKEN_BYTES).toString(
					'base64url'
				);
				const session = new MachineSession();
				session.id = v4();
				session.machineId = machineId;
				session.generation = machine.sessionGeneration;
				session.tokenHash = this.hashToken(token);
				session.expiresAt = expiresAt;
				session.revokedAt = null;
				session.createdAt = now;
				session.updatedAt = now;
				manager.persist(session);

				return {
					sessionId: session.id,
					tokenType: MACHINE_AUTHORIZATION_SCHEME,
					token,
					expiresAt: session.expiresAt.toISOString(),
					generation: session.generation,
				} satisfies MachineSessionDto;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	authenticate(
		request: Request,
		now?: Date
	): Promise<{ machine: Machine; session: MachineSession }> {
		return observeOperation('machine.session.authenticate', {}, () =>
			this.authenticateRequest(request, now)
		);
	}

	private async authenticateRequest(
		request: Request,
		now?: Date
	): Promise<{ machine: Machine; session: MachineSession }> {
		const token = this.readAuthorization(request);
		const observedAt = now ?? (await databaseNow(this.entityManager));
		const session = await this.entityManager.findOne(MachineSession, {
			tokenHash: this.hashToken(token),
		});
		if (!session) {
			throw new UnauthorizedException('Machine session is invalid or expired');
		}
		const machine = await this.entityManager.findOne(Machine, {
			id: session.machineId,
		});
		if (!machine || !isMachineSessionCurrent(machine, session, observedAt)) {
			throw new UnauthorizedException('Machine session has been fenced');
		}
		await this.machineProofService.verify(request, machine, token);
		return { machine, session };
	}

	async assertCurrent(
		manager: EntityManager,
		machineId: string,
		sessionId: string,
		now?: Date
	): Promise<Machine> {
		const observedAt = now ?? (await databaseNow(manager));
		const machine = await manager.findOne(
			Machine,
			{ id: machineId },
			{ lockMode: LockMode.PESSIMISTIC_READ }
		);
		if (!machine)
			throw new UnauthorizedException('Machine session has been fenced');

		const session = await manager.findOne(MachineSession, {
			id: sessionId,
			machineId,
		});
		if (!isMachineSessionCurrent(machine, session, observedAt)) {
			throw new UnauthorizedException('Machine session has been fenced');
		}
		return machine;
	}

	async renew(session: MachineSession): Promise<RenewMachineSessionDto> {
		return this.entityManager.transactional(
			async (manager) => {
				const machine = await lockMachineForUpdate(manager, session.machineId);
				const current = await manager.findOne(
					MachineSession,
					{ id: session.id },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				const now = await databaseNow(manager);
				if (
					!machine ||
					!current ||
					current.revokedAt ||
					current.expiresAt <= now ||
					machine.sessionGeneration !== current.generation
				) {
					throw new ConflictException(
						'Machine session can no longer be renewed'
					);
				}
				current.expiresAt = addMilliseconds(now, MACHINE_SESSION_DURATION_MS);
				machine.sessionExpiresAt = current.expiresAt;
				this.advanceTunnelPlan(machine, now);
				return { expiresAt: current.expiresAt.toISOString() };
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async close(session: MachineSession): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const machine = await lockMachineForUpdate(manager, session.machineId);
				const current = await manager.findOne(
					MachineSession,
					{ id: session.id },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				const now = await databaseNow(manager);
				if (
					!machine ||
					!current ||
					current.revokedAt ||
					machine.sessionGeneration !== current.generation
				) {
					throw new ConflictException(
						'Machine session has already been fenced'
					);
				}
				current.revokedAt = now;
				machine.sessionExpiresAt = null;
				const closedState = machineStateAfterSessionClose(machine.state);
				machine.state = closedState.state;
				if (closedState.clearReadinessReason) {
					machine.readinessReason = null;
				}
				this.advanceTunnelPlan(machine, now);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private hashToken(token: string): string {
		return createHash(MACHINE_SESSION_TOKEN_HASH_ALGORITHM)
			.update(token)
			.digest('hex');
	}

	private advanceTunnelPlan(machine: Machine, generatedAt: Date): void {
		machine.tunnelPlanVersion = (
			BigInt(machine.tunnelPlanVersion) + 1n
		).toString();
		machine.tunnelPlanGeneratedAt = generatedAt;
	}

	private readAuthorization(request: Request): string {
		const authorization = request.headers.authorization?.trim();
		const match = authorization?.match(/^(\S+)\s+(\S+)$/);
		if (
			!match ||
			match[1].toLowerCase() !== MACHINE_AUTHORIZATION_SCHEME.toLowerCase()
		) {
			throw new UnauthorizedException(
				`Authorization must use the ${MACHINE_AUTHORIZATION_SCHEME} scheme`
			);
		}
		return match[2];
	}
}

function machineStateAfterSessionClose(state: MachineState) {
	if (state === MachineState.INITIALIZING) {
		return { state: MachineState.FAILED, clearReadinessReason: false } as const;
	}
	if (
		state === MachineState.FAILED ||
		state === MachineState.DISABLED ||
		state === MachineState.DECOMMISSIONED
	) {
		return { state, clearReadinessReason: false } as const;
	}
	return {
		state: MachineState.DRAINING,
		clearReadinessReason: true,
	} as const;
}

function isMachineSessionCurrent(
	machine: Pick<Machine, 'sessionGeneration'> | null,
	session: Pick<
		MachineSession,
		'generation' | 'expiresAt' | 'revokedAt'
	> | null,
	observedAt: Date
): boolean {
	return Boolean(
		machine &&
			session &&
			!session.revokedAt &&
			session.expiresAt > observedAt &&
			machine.sessionGeneration === session.generation
	);
}
