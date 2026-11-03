/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes } from 'node:crypto';
import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { isUniqueViolation } from '../../../../common/utils/error/database-error.util';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { addMilliseconds } from '../../../../common/utils/time.util';
import { ControlWakeService } from '../../../../infra/control-wake/services/control-wake.service';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import {
	EDGE_IDENTITY,
	EDGE_STATUS,
	type EdgeStatus,
} from '../../constants/edge.constants';
import { ACTIVE_BACKEND_STATES } from '../../constants/exposure.constants';
import { NETWORK_WAKE_TOPIC } from '../../constants/networking.constants';
import type {
	CreateEdgeSessionDto,
	EdgeSessionDto,
	RenewEdgeSessionDto,
} from '../../dto/edge-identity.dto';
import { Edge } from '../../entities/edge.entity';
import { EdgeSession } from '../../entities/edge-session.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import {
	edgeSecretsMatch,
	hashEdgeSecret,
	verifyEdgeIdentityProof,
} from '../../utils/edge/edge-identity.util';
import { isEdgeSessionGenerationAccepted } from '../../utils/edge/edge-session-generation.util';
import { lockEdges } from '../../utils/network-lock.util';

const SESSION_ELIGIBLE_EDGE_STATUSES = new Set<EdgeStatus>([
	EDGE_STATUS.ACTIVE,
	EDGE_STATUS.DRAINING,
]);

@Injectable()
export class EdgeSessionService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly wakes: ControlWakeService
	) {}

	async create(input: CreateEdgeSessionDto): Promise<EdgeSessionDto> {
		try {
			const session = await this.createInTransaction(input);
			this.wakes.notify(NETWORK_WAKE_TOPIC.EDGE_ROUTES, [input.edgeId]);
			return session;
		} catch (error: unknown) {
			if (isUniqueViolation(error)) {
				throw new ForbiddenException(
					'Edge session proof nonce was already used'
				);
			}
			throw error;
		}
	}

	private createInTransaction(
		input: CreateEdgeSessionDto
	): Promise<EdgeSessionDto> {
		return this.entityManager.transactional(
			async (manager) => {
				const [edge] = await lockEdges(manager, [input.edgeId]);
				if (
					!edge ||
					!SESSION_ELIGIBLE_EDGE_STATUSES.has(edge.status) ||
					!edge.identityPublicKey ||
					!edge.identityKeyId
				) {
					throw new ForbiddenException(
						'Edge is not eligible for a live session'
					);
				}
				const now = await databaseNow(manager);
				let proofIssuedAt: Date;
				try {
					proofIssuedAt = verifyEdgeIdentityProof({
						identityPublicKey: edge.identityPublicKey,
						issuedAt: input.issuedAt,
						nonce: input.nonce,
						signature: input.signature,
						payload: [
							EDGE_IDENTITY.sessionProofDomain,
							edge.id,
							edge.identityKeyId,
						],
						observedAt: now,
					});
				} catch (error: unknown) {
					const message = errorMessage(error);
					throw new ForbiddenException(
						`Invalid Edge session proof: ${message}`
					);
				}

				const liveSessions = await manager.find(
					EdgeSession,
					{ edgeId: edge.id, revokedAt: null },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				const replacementGraceDeadline = addMilliseconds(
					now,
					EDGE_IDENTITY.sessionReplacementGraceMilliseconds
				);
				for (const liveSession of liveSessions) {
					if (
						liveSession.generation === edge.sessionGeneration &&
						liveSession.expiresAt > now
					) {
						liveSession.replacementGraceExpiresAt = new Date(
							Math.min(
								liveSession.expiresAt.getTime(),
								replacementGraceDeadline.getTime()
							)
						);
						continue;
					}
					liveSession.revokedAt = now;
					liveSession.replacementGraceExpiresAt = null;
				}
				edge.sessionGeneration += 1;
				const expiresAt = addMilliseconds(
					now,
					EDGE_IDENTITY.sessionDurationMilliseconds
				);
				edge.sessionExpiresAt = expiresAt;
				edge.routeTableVersion = (
					BigInt(edge.routeTableVersion) + 1n
				).toString();
				edge.routeTableGeneratedAt = now;
				await manager.nativeUpdate(
					ExposureBackend,
					{ edgeId: edge.id, state: { $in: [...ACTIVE_BACKEND_STATES] } },
					{ routeTableVersion: edge.routeTableVersion, updatedAt: now }
				);

				const token = randomBytes(EDGE_IDENTITY.sessionTokenBytes).toString(
					'base64url'
				);
				const session = new EdgeSession();
				session.id = v4();
				session.edgeId = edge.id;
				session.generation = edge.sessionGeneration;
				session.tokenHash = hashEdgeSecret(token);
				session.proofNonce = input.nonce;
				session.proofIssuedAt = proofIssuedAt;
				session.expiresAt = expiresAt;
				session.replacementGraceExpiresAt = null;
				session.revokedAt = null;
				session.createdAt = now;
				session.updatedAt = now;
				manager.persist(session);
				return {
					id: session.id,
					token,
					expiresAt: session.expiresAt.toISOString(),
					generation: session.generation,
				};
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async authenticate(
		sessionId: string,
		token: string,
		now?: Date
	): Promise<EdgeSession> {
		const observedAt = now ?? (await databaseNow(this.entityManager));
		const session = await this.entityManager.findOne(EdgeSession, {
			id: sessionId,
		});
		if (
			!session ||
			session.revokedAt ||
			session.expiresAt <= observedAt ||
			!edgeSecretsMatch(token, session.tokenHash)
		) {
			throw new UnauthorizedException('Edge session is invalid or expired');
		}
		const edge = await this.entityManager.findOne(Edge, { id: session.edgeId });
		if (!edge || !SESSION_ELIGIBLE_EDGE_STATUSES.has(edge.status)) {
			throw new ForbiddenException('Edge is not eligible for a live session');
		}
		if (
			!isEdgeSessionGenerationAccepted(
				edge.sessionGeneration,
				session.generation,
				session.replacementGraceExpiresAt,
				observedAt
			)
		) {
			throw new UnauthorizedException('Edge session has been fenced');
		}
		return session;
	}

	async assertCurrent(
		manager: EntityManager,
		edgeId: string,
		sessionId: string,
		now?: Date
	): Promise<void> {
		const observedAt = now ?? (await databaseNow(manager));
		const edge = await manager.findOne(
			Edge,
			{ id: edgeId },
			{ lockMode: LockMode.PESSIMISTIC_READ }
		);
		const session = await manager.findOne(EdgeSession, {
			id: sessionId,
			edgeId,
		});
		if (
			!edge ||
			!SESSION_ELIGIBLE_EDGE_STATUSES.has(edge.status) ||
			!session ||
			session.revokedAt ||
			session.expiresAt <= observedAt ||
			edge.sessionGeneration !== session.generation
		) {
			throw new UnauthorizedException('Edge session has been fenced');
		}
	}

	async renew(session: EdgeSession): Promise<RenewEdgeSessionDto> {
		const renewed = await this.entityManager.transactional(
			async (manager) => {
				const [edge] = await lockEdges(manager, [session.edgeId]);
				const current = await manager.findOne(
					EdgeSession,
					{ id: session.id },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				const now = await databaseNow(manager);
				if (
					!edge ||
					!SESSION_ELIGIBLE_EDGE_STATUSES.has(edge.status) ||
					!current ||
					current.revokedAt ||
					current.expiresAt <= now ||
					edge.sessionGeneration !== current.generation
				) {
					throw new UnauthorizedException(
						'Edge session can no longer be renewed'
					);
				}
				current.expiresAt = addMilliseconds(
					now,
					EDGE_IDENTITY.sessionDurationMilliseconds
				);
				edge.sessionExpiresAt = current.expiresAt;
				edge.routeTableVersion = (
					BigInt(edge.routeTableVersion) + 1n
				).toString();
				edge.routeTableGeneratedAt = now;
				await manager.nativeUpdate(
					ExposureBackend,
					{ edgeId: edge.id, state: { $in: [...ACTIVE_BACKEND_STATES] } },
					{ routeTableVersion: edge.routeTableVersion, updatedAt: now }
				);
				return { expiresAt: current.expiresAt.toISOString() };
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		this.wakes.notify(NETWORK_WAKE_TOPIC.EDGE_ROUTES, [session.edgeId]);
		return renewed;
	}
}
