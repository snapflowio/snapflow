/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createPublicKey, verify } from 'node:crypto';
import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	GoneException,
	Injectable,
	Logger,
	UnprocessableEntityException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { MachinePlatformObservationService } from '../../../../sandbox/machine/services/machine-platform-observation.service';
import { NetworkUsageService } from '../../../usage/services/network-usage.service';
import {
	EDGE_CONTROL_LIMITS,
	EDGE_USAGE_CHAIN_POSITION,
} from '../../constants/edge.constants';
import {
	EdgeUsageCheckpointAcknowledgementDto,
	type EdgeUsageCheckpointDto,
	type EdgeUsageEpochDto,
	type EdgeUsageSampleDto,
} from '../../dto/edge-usage.dto';
import { Edge } from '../../entities/edge.entity';
import { EdgeSession } from '../../entities/edge-session.entity';
import { EdgeUsageCheckpoint } from '../../entities/edge-usage-checkpoint.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import {
	edgeUsageDigest,
	edgeUsageSignaturePayload,
} from '../../utils/edge/edge-usage.util';
import { edgeUsageChainPosition } from '../../utils/edge/edge-usage-chain.util';
import { isEdgeUsageIntervalWithinSession } from '../../utils/edge/edge-usage-session.util';
import { parseSupportedUsageCounter } from '../../utils/edge/usage-counter.util';
import { lockEdges } from '../../utils/network-lock.util';
import { EdgeActivityService } from './edge-activity.service';
import { EdgeSessionService } from './edge-session.service';

@Injectable()
export class EdgeUsageService {
	private readonly logger = new Logger(EdgeUsageService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sessions: EdgeSessionService,
		private readonly edgeActivity: EdgeActivityService,
		private readonly networkUsage: NetworkUsageService,
		private readonly platformObservations: MachinePlatformObservationService
	) {}

	async ingest(
		session: EdgeSession,
		input: EdgeUsageCheckpointDto
	): Promise<EdgeUsageCheckpointAcknowledgementDto> {
		const result = await this.entityManager.transactional(
			async (manager) => {
				parseSupportedUsageCounter(input.sequence, 'sequence', true);
				const { edge, observedAt } = await this.lockEdgeUsage(manager, session);
				const identityPublicKey = edge.identityPublicKey;
				if (!identityPublicKey) {
					throw new ConflictException('Edge identity is unavailable');
				}
				const duplicate = await manager.findOne(EdgeUsageCheckpoint, {
					edgeId: edge.id,
					usageEpoch: input.usageEpoch,
					sequence: input.sequence,
				});
				if (duplicate) {
					if (duplicate.digest !== input.digest) {
						throw new ConflictException(
							'Usage sequence was replayed with different data'
						);
					}
					return {
						acknowledgement:
							EdgeUsageCheckpointAcknowledgementDto.from(duplicate),
						observedAt,
						sandboxIds: [],
						servedPlacementIds: [],
					};
				}
				await this.assertChainPosition(manager, edge, input);
				this.validateInterval(input, observedAt);
				await this.validateMeteringSession(manager, edge, input);
				this.validateCounters(input);
				const { backends, samples, sandboxIds, servedPlacementIds } =
					await this.attributableSamples(manager, edge.id, input);
				this.verifyEvidence(edge.id, identityPublicKey, input);
				const checkpoint = new EdgeUsageCheckpoint();
				checkpoint.id = v4();
				checkpoint.edgeId = edge.id;
				checkpoint.usageEpoch = input.usageEpoch;
				checkpoint.sequence = input.sequence;
				checkpoint.previousDigest = input.previousDigest ?? null;
				checkpoint.digest = input.digest;
				checkpoint.edgeSessionGeneration = input.edgeSessionGeneration;
				checkpoint.intervalStartedAt = new Date(input.intervalStartedAt);
				checkpoint.intervalEndedAt = new Date(input.intervalEndedAt);
				checkpoint.payload = {
					intervalStartedAt: new Date(input.intervalStartedAt).toISOString(),
					intervalEndedAt: new Date(input.intervalEndedAt).toISOString(),
					samples: input.samples,
				};
				checkpoint.signature = input.signature;
				checkpoint.signerPublicKey = identityPublicKey;
				checkpoint.acceptedAt = observedAt;
				manager.persist(checkpoint);
				await this.networkUsage.recordEdgeCheckpoint(
					manager,
					checkpoint,
					samples,
					backends
				);
				return {
					acknowledgement:
						EdgeUsageCheckpointAcknowledgementDto.from(checkpoint),
					observedAt,
					sandboxIds,
					servedPlacementIds,
				};
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		await this.edgeActivity.recordSandboxActivity(
			result.sandboxIds,
			result.observedAt
		);
		try {
			await this.platformObservations.observeEdgeServed(
				result.servedPlacementIds
			);
		} catch (error) {
			this.logger.warn(
				`Failed to record edge-served placements: ${errorMessage(error)}`
			);
		}
		return result.acknowledgement;
	}

	openEpoch(session: EdgeSession): Promise<EdgeUsageEpochDto> {
		return this.entityManager.transactional(
			async (manager) => {
				await lockEdges(manager, [session.edgeId]);
				const { edge } = await this.lockEdgeUsage(manager, session);
				const latest = await this.latestCheckpoint(manager, edge.id);
				edge.usageEpoch += 1;
				return {
					usageEpoch: edge.usageEpoch,
					previousDigest: latest?.digest,
				};
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async lockEdgeUsage(
		manager: EntityManager,
		session: EdgeSession
	): Promise<{ edge: Edge; observedAt: Date }> {
		const observedAt = await databaseNow(manager);
		await this.sessions.assertCurrent(
			manager,
			session.edgeId,
			session.id,
			observedAt
		);
		await manager.execute('SELECT pg_advisory_xact_lock(hashtext(?))', [
			`edge-usage:${session.edgeId}`,
		]);
		const edge = await manager.findOneOrFail(Edge, { id: session.edgeId });
		return { edge, observedAt };
	}

	private latestCheckpoint(
		manager: EntityManager,
		edgeId: string
	): Promise<EdgeUsageCheckpoint | null> {
		return manager.findOne(
			EdgeUsageCheckpoint,
			{ edgeId },
			{ orderBy: { usageEpoch: 'DESC', sequence: 'DESC' } }
		);
	}

	private async assertChainPosition(
		manager: EntityManager,
		edge: Edge,
		input: EdgeUsageCheckpointDto
	): Promise<void> {
		const position = edgeUsageChainPosition(
			input,
			edge.usageEpoch,
			await this.latestCheckpoint(manager, edge.id)
		);
		if (position === EDGE_USAGE_CHAIN_POSITION.EPOCH_CLOSED) {
			throw new GoneException(
				'Usage epoch cannot be continued; open a new usage epoch'
			);
		}
		if (position === EDGE_USAGE_CHAIN_POSITION.CONFLICT) {
			throw new ConflictException(
				'Usage sequence precedes the accepted digest chain'
			);
		}
	}

	private verifyEvidence(
		edgeId: string,
		identityPublicKey: string,
		input: EdgeUsageCheckpointDto
	): void {
		const digest = edgeUsageDigest(edgeId, {
			usageEpoch: input.usageEpoch,
			sequence: input.sequence,
			previousDigest: input.previousDigest ?? null,
			edgeSessionGeneration: input.edgeSessionGeneration,
			intervalStartedAt: new Date(input.intervalStartedAt).toISOString(),
			intervalEndedAt: new Date(input.intervalEndedAt).toISOString(),
			samples: input.samples,
		});
		if (digest !== input.digest) {
			throw new UnprocessableEntityException(
				'Usage checkpoint digest is invalid'
			);
		}
		if (
			!verify(
				null,
				edgeUsageSignaturePayload(edgeId, input),
				createPublicKey(identityPublicKey),
				Buffer.from(input.signature, 'base64url')
			)
		) {
			throw new UnprocessableEntityException(
				'Usage checkpoint signature is invalid'
			);
		}
	}

	private async validateMeteringSession(
		manager: EntityManager,
		edge: Edge,
		input: EdgeUsageCheckpointDto
	): Promise<void> {
		if (input.edgeSessionGeneration > edge.sessionGeneration) {
			throw new UnprocessableEntityException(
				'Usage checkpoint has a future session generation'
			);
		}
		const meteringSession = await manager.findOne(EdgeSession, {
			edgeId: edge.id,
			generation: input.edgeSessionGeneration,
		});
		const intervalStartedAt = new Date(input.intervalStartedAt);
		const intervalEndedAt = new Date(input.intervalEndedAt);
		if (
			!isEdgeUsageIntervalWithinSession(
				meteringSession,
				intervalStartedAt,
				intervalEndedAt
			)
		) {
			throw new UnprocessableEntityException(
				'Usage checkpoint interval is outside its Edge session'
			);
		}
	}

	private validateCounters(input: EdgeUsageCheckpointDto): void {
		for (const sample of input.samples) {
			parseSupportedUsageCounter(sample.bytesIn, 'bytes in');
			parseSupportedUsageCounter(sample.bytesOut, 'bytes out');
			parseSupportedUsageCounter(sample.packetsIn, 'packets in');
			parseSupportedUsageCounter(sample.packetsOut, 'packets out');
		}
	}

	private validateInterval(
		input: EdgeUsageCheckpointDto,
		observedAt: Date
	): void {
		const startedAt = new Date(input.intervalStartedAt).getTime();
		const endedAt = new Date(input.intervalEndedAt).getTime();
		if (
			endedAt <= startedAt ||
			endedAt - startedAt >
				EDGE_CONTROL_LIMITS.maximumUsageIntervalMilliseconds ||
			endedAt <
				observedAt.getTime() -
					EDGE_CONTROL_LIMITS.maximumUsageLatenessMilliseconds ||
			endedAt >
				observedAt.getTime() +
					EDGE_CONTROL_LIMITS.maximumUsageClockSkewMilliseconds
		) {
			throw new UnprocessableEntityException(
				'Usage checkpoint interval is invalid'
			);
		}
	}

	private async attributableSamples(
		manager: EntityManager,
		edgeId: string,
		input: EdgeUsageCheckpointDto
	): Promise<{
		backends: Map<string, ExposureBackend>;
		samples: EdgeUsageSampleDto[];
		sandboxIds: string[];
		servedPlacementIds: string[];
	}> {
		const ids = input.samples.map((sample) => sample.backendId);
		if (new Set(ids).size !== ids.length) {
			throw new UnprocessableEntityException(
				'Usage checkpoint repeats a backend'
			);
		}
		const backends =
			ids.length === 0
				? []
				: await manager.find(ExposureBackend, {
						id: { $in: ids },
						edgeId,
					});
		const byId = new Map(backends.map((backend) => [backend.id, backend]));
		const intervalStartedAt = new Date(input.intervalStartedAt);
		const intervalEndedAt = new Date(input.intervalEndedAt);
		const sandboxIds = new Set<string>();
		const servedPlacementIds = new Set<string>();
		const samples = input.samples.filter((sample) => {
			const backend = byId.get(sample.backendId);
			if (
				backend === undefined ||
				backend.assignmentGeneration !== sample.assignmentGeneration ||
				backend.protocol !== sample.protocol ||
				intervalEndedAt < backend.createdAt ||
				(backend.releasedAt !== null && intervalStartedAt > backend.releasedAt)
			) {
				this.logger.warn(
					`Dropped Edge usage for backend ${sample.backendId} not assigned to Edge ${edgeId} during sequence ${input.sequence}`
				);
				return false;
			}
			sandboxIds.add(backend.sandboxId);
			if (BigInt(sample.bytesOut) > 0n)
				servedPlacementIds.add(backend.placementId);
			return true;
		});
		return {
			backends: byId,
			samples,
			sandboxIds: [...sandboxIds],
			servedPlacementIds: [...servedPlacementIds],
		};
	}
}
