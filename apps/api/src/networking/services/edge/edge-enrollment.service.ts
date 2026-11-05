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
	ConflictException,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { EDGE_IDENTITY, EDGE_STATUS } from '../../constants/edge.constants';
import type {
	CompleteEdgeEnrollmentDto,
	EdgeEnrollmentDto,
} from '../../dto/edge-identity.dto';
import {
	canonicalizeEdgeIdentity,
	edgeSecretsMatch,
	verifyEdgeIdentityProof,
} from '../../utils/edge/edge-identity.util';
import { lockEdges } from '../../utils/network-lock.util';

@Injectable()
export class EdgeEnrollmentService {
	constructor(private readonly entityManager: EntityManager) {}

	async complete(input: CompleteEdgeEnrollmentDto): Promise<EdgeEnrollmentDto> {
		return this.entityManager.transactional(
			async (manager) => {
				const [edge] = await lockEdges(manager, [input.edgeId]);
				if (!edge) throw new ForbiddenException('Edge enrollment is invalid');
				const now = await databaseNow(manager);
				if (
					edge.status !== EDGE_STATUS.ENROLLING ||
					!edge.enrollmentSecretHash ||
					!edge.enrollmentSecretExpiresAt ||
					edge.enrollmentSecretExpiresAt <= now ||
					!edgeSecretsMatch(input.enrollmentSecret, edge.enrollmentSecretHash)
				) {
					throw new ForbiddenException('Edge enrollment is invalid or expired');
				}

				let identityPublicKey: string;
				try {
					identityPublicKey = canonicalizeEdgeIdentity(
						input.identityPublicKey,
						input.identityKeyId
					);
					verifyEdgeIdentityProof({
						identityPublicKey,
						issuedAt: input.issuedAt,
						nonce: input.nonce,
						signature: input.signature,
						payload: [
							EDGE_IDENTITY.enrollmentProofDomain,
							edge.id,
							input.identityKeyId,
						],
						observedAt: now,
					});
				} catch (error: unknown) {
					const message = errorMessage(error);
					throw new BadRequestException(
						`Invalid Edge identity proof: ${message}`
					);
				}

				edge.identityPublicKey = identityPublicKey;
				edge.identityKeyId = input.identityKeyId;
				edge.identityKeyRegisteredAt = now;
				edge.enrollmentSecretHash = null;
				edge.enrollmentSecretExpiresAt = null;
				edge.enrollmentCompletedAt = now;
				edge.status = EDGE_STATUS.ACTIVE;
				try {
					await manager.flush();
				} catch (error: unknown) {
					if (isUniqueViolation(error)) {
						throw new ConflictException('Edge identity is already registered');
					}
					throw error;
				}

				return {
					edgeId: edge.id,
					enrolledAt: now.toISOString(),
					credentialGeneration: edge.credentialGeneration,
				};
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}
}
