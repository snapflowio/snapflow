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
	ConflictException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { idBatches } from '../../../../infra/database/utils/row-lock.util';
import { ACTIVE_BACKEND_STATES } from '../../constants/exposure.constants';
import {
	LIVE_BINDING_STATES,
	MACHINE_EDGE_BINDING_STATE,
} from '../../constants/machine-tunnel.constants';
import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import type {
	EdgeBindingAcknowledgementDto,
	EdgeHeartbeatDto,
	EdgeHeartbeatResponseDto,
	EdgeRouteListenerStatusDto,
} from '../../dto/edge-heartbeat.dto';
import type { Edge } from '../../entities/edge.entity';
import type { EdgeSession } from '../../entities/edge-session.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import {
	bindingAcknowledgementIsCurrent,
	listenerObservationIsCurrent,
	routeSnapshotAcknowledgementIsCurrent,
} from '../../utils/edge/edge-heartbeat-observation.util';
import {
	lockBackends,
	lockBindings,
	lockEdges,
} from '../../utils/network-lock.util';
import { ExposureActivationService } from '../exposure/exposure-activation.service';
import { EdgeActivityService } from './edge-activity.service';
import { EdgeSessionService } from './edge-session.service';

const LISTENER_NOT_ACCEPTING_REASON = 'Edge listener is not accepting traffic';

@Injectable()
export class EdgeHeartbeatService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly edgeSessionService: EdgeSessionService,
		private readonly exposureActivation: ExposureActivationService,
		private readonly edgeActivity: EdgeActivityService
	) {}

	async record(
		session: EdgeSession,
		input: EdgeHeartbeatDto
	): Promise<EdgeHeartbeatResponseDto> {
		const recorded = await this.entityManager.transactional(
			async (manager) => {
				const observedAt = await databaseNow(manager);
				const [edge] = await lockEdges(manager, [session.edgeId]);
				if (!edge)
					throw new UnauthorizedException('Edge session has been fenced');
				await this.edgeSessionService.assertCurrent(
					manager,
					session.edgeId,
					session.id,
					observedAt
				);

				edge.lastHeartbeatAt = observedAt;
				edge.lastStartedAt = new Date(input.startedAt);
				edge.lastReportedVersion = input.version;
				edge.lastReportedRouteTableVersion = input.routeTableVersion;
				edge.observedCapacity = input.capacity;
				const observations = await this.recordObservations(
					manager,
					edge,
					input,
					observedAt
				);
				return {
					observedAt,
					observations,
					response: {
						edgeId: edge.id,
						status: edge.status,
						capacityProfile: edge.capacityProfile,
						routeTableVersion: edge.routeTableVersion,
					},
				};
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		await this.exposureActivation.activateReadyForObservations(
			this.entityManager,
			recorded.observations.bindingIds,
			recorded.observations.backendIds
		);
		const accessSessions = await this.edgeActivity.observeAccessSessions(
			session.edgeId,
			input.activeAccessSessionIds ?? [],
			recorded.observedAt
		);
		return {
			...recorded.response,
			accessSessions: accessSessions.sessions,
			revokedAccessSessionIds: accessSessions.revokedSessionIds,
		};
	}

	private async recordObservations(
		manager: EntityManager,
		edge: Edge,
		input: EdgeHeartbeatDto,
		observedAt: Date
	): Promise<{ bindingIds: string[]; backendIds: string[] }> {
		const acknowledgements = input.bindingAcknowledgements ?? [];
		this.assertUnique(
			acknowledgements.map(({ bindingId }) => bindingId),
			'Heartbeat repeats a binding acknowledgement'
		);
		this.assertUnique(
			input.routeListeners.map(({ backendId }) => backendId),
			'Heartbeat repeats a listener status'
		);
		const acknowledged = routeSnapshotAcknowledgementIsCurrent(
			edge.routeTableVersion,
			input.routeTableVersion
		)
			? await this.acknowledgeBindings(
					manager,
					edge,
					acknowledgements,
					observedAt
				)
			: new Map<string, EdgeBindingAcknowledgementDto>();
		const backends = await lockBackends(
			manager,
			[
				...(await this.findHttpBackendIds(manager, acknowledged, observedAt)),
				...input.routeListeners.map(({ backendId }) => backendId),
			],
			{
				edgeId: edge.id,
				state: { $in: [...ACTIVE_BACKEND_STATES] },
				leaseExpiresAt: { $gt: observedAt },
			}
		);
		this.acknowledgeHttpBackends(backends, acknowledged, observedAt);
		return {
			bindingIds: [...acknowledged.keys()],
			backendIds: this.recordListenerStatuses(
				backends,
				input.routeTableVersion,
				input.routeListeners,
				observedAt
			),
		};
	}

	private async acknowledgeBindings(
		manager: EntityManager,
		edge: Edge,
		acknowledgements: readonly EdgeBindingAcknowledgementDto[],
		observedAt: Date
	): Promise<Map<string, EdgeBindingAcknowledgementDto>> {
		const bindings = await lockBindings(
			manager,
			acknowledgements.map(({ bindingId }) => bindingId),
			{
				edgeId: edge.id,
				observedState: { $in: [...LIVE_BINDING_STATES] },
				leaseExpiresAt: { $gt: observedAt },
			}
		);
		const bindingById = new Map(
			bindings.map((binding) => [binding.id, binding])
		);
		const acknowledged = new Map<string, EdgeBindingAcknowledgementDto>();
		for (const acknowledgement of acknowledgements) {
			const binding = bindingById.get(acknowledgement.bindingId) ?? null;
			if (
				binding?.machineId !== acknowledgement.machineId ||
				binding.revision !== acknowledgement.bindingRevision ||
				binding.digest !== acknowledgement.bindingDigest ||
				!bindingAcknowledgementIsCurrent(binding, acknowledgement.connectionId)
			)
				continue;
			binding.activeConnectionId = acknowledgement.connectionId;
			binding.replacementConnectionId = null;
			binding.lastAcknowledgedAt = observedAt;
			binding.observedState = MACHINE_EDGE_BINDING_STATE.ACTIVE;
			acknowledged.set(binding.id, acknowledgement);
		}
		return acknowledged;
	}

	private async findHttpBackendIds(
		manager: EntityManager,
		acknowledged: ReadonlyMap<string, EdgeBindingAcknowledgementDto>,
		observedAt: Date
	): Promise<string[]> {
		const backendIds: string[] = [];
		for (const batch of idBatches(acknowledged.keys())) {
			const backends = await manager.find(
				ExposureBackend,
				{
					bindingId: { $in: batch },
					protocol: NETWORK_PROTOCOL.HTTP,
					state: { $in: [...ACTIVE_BACKEND_STATES] },
					leaseExpiresAt: { $gt: observedAt },
				},
				{ fields: ['id'], disableIdentityMap: true }
			);
			backendIds.push(...backends.map(({ id }) => id));
		}
		return backendIds;
	}

	private acknowledgeHttpBackends(
		backends: readonly ExposureBackend[],
		acknowledged: ReadonlyMap<string, EdgeBindingAcknowledgementDto>,
		observedAt: Date
	): void {
		for (const backend of backends) {
			const acknowledgement = acknowledged.get(backend.bindingId);
			if (
				backend.protocol === NETWORK_PROTOCOL.HTTP &&
				acknowledgement &&
				backend.bindingRevision === acknowledgement.bindingRevision &&
				backend.bindingDigest === acknowledgement.bindingDigest
			) {
				backend.edgeAcknowledgedAt = observedAt;
			}
		}
	}

	private recordListenerStatuses(
		backends: readonly ExposureBackend[],
		routeTableVersion: string,
		statuses: readonly EdgeRouteListenerStatusDto[],
		observedAt: Date
	): string[] {
		const backendById = new Map(
			backends.map((backend) => [backend.id, backend])
		);
		const acknowledged: string[] = [];
		for (const status of statuses) {
			const backend = backendById.get(status.backendId) ?? null;
			if (
				backend?.protocol !== status.protocol ||
				backend.publicPort !== status.publicPort
			)
				continue;
			if (!listenerObservationIsCurrent(backend, routeTableVersion)) continue;
			backend.edgeAcknowledgedAt = status.listening ? observedAt : null;
			backend.failureReason = status.listening
				? null
				: (status.failureReason ?? LISTENER_NOT_ACCEPTING_REASON);
			acknowledged.push(backend.id);
		}
		return acknowledged;
	}

	private assertUnique(ids: readonly string[], message: string): void {
		if (new Set(ids).size !== ids.length) {
			throw new ConflictException(message);
		}
	}
}
