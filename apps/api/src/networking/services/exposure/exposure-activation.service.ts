/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { TransactionPropagation } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { addMilliseconds } from '../../../common/utils/time.util';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { TransactionCommitHooks } from '../../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_OBSERVED_STATE,
} from '../../constants/exposure.constants';
import {
	NETWORK_PROTOCOL,
	NETWORK_WAKE_TOPIC,
	NETWORKING_RECONCILIATION,
} from '../../constants/networking.constants';
import { NetworkingEvents } from '../../constants/networking-events.constants';
import type { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { exposureCutoverAllowsActivation } from '../../utils/exposure/exposure-cutover.util';
import { lockExposureNetwork } from '../../utils/network-lock.util';
import { NetworkControlVersionService } from '../network-control-version.service';

@Injectable()
export class ExposureActivationService {
	constructor(
		private readonly versions: NetworkControlVersionService,
		private readonly wakes: ControlWakeService,
		private readonly events: EventEmitter2,
		private readonly commitHooks: TransactionCommitHooks
	) {}

	async activateReadyForBinding(
		manager: EntityManager,
		bindingId: string
	): Promise<void> {
		await this.activateReadyForObservations(manager, [bindingId], []);
	}

	async activateReadyBackend(
		manager: EntityManager,
		backendId: string
	): Promise<void> {
		await this.activateReadyForObservations(manager, [], [backendId]);
	}

	async activateReadyForObservations(
		manager: EntityManager,
		bindingIds: readonly string[],
		backendIds: readonly string[]
	): Promise<void> {
		const observedBindingIds = new Set(bindingIds);
		const observedBackendIds = new Set(backendIds);
		if (observedBindingIds.size === 0 && observedBackendIds.size === 0) return;
		await manager.transactional(
			async (transaction) => {
				const planned = await transaction.find(
					ExposureBackend,
					{
						state: EXPOSURE_BACKEND_STATE.PENDING,
						edgeAcknowledgedAt: { $ne: null },
						machineAcknowledgedAt: { $ne: null },
						$or: [
							...(observedBindingIds.size > 0
								? [{ bindingId: { $in: [...observedBindingIds] } }]
								: []),
							...(observedBackendIds.size > 0
								? [{ id: { $in: [...observedBackendIds] } }]
								: []),
						],
					},
					{ fields: ['exposureId'], disableIdentityMap: true }
				);
				if (planned.length === 0) return;
				const { exposures, backends } = await lockExposureNetwork(
					transaction,
					planned.map((backend) => backend.exposureId)
				);
				const candidates = backends
					.filter(
						(backend) =>
							backend.state === EXPOSURE_BACKEND_STATE.PENDING &&
							backend.edgeAcknowledgedAt !== null &&
							backend.machineAcknowledgedAt !== null &&
							(observedBindingIds.has(backend.bindingId) ||
								observedBackendIds.has(backend.id))
					)
					.sort((left, right) => (left.id < right.id ? -1 : 1));
				if (candidates.length === 0) return;
				this.requestDnsActivation(transaction, candidates);
				await this.activateCandidates(
					transaction,
					exposures,
					backends,
					candidates,
					await databaseNow(transaction)
				);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async activateCandidates(
		manager: EntityManager,
		exposures: readonly Exposure[],
		liveBackends: readonly ExposureBackend[],
		candidates: readonly ExposureBackend[],
		observedAt: Date
	): Promise<void> {
		const exposureById = new Map(
			exposures.map((exposure) => [exposure.id, exposure])
		);
		const relatedByExposureId = new Map<string, ExposureBackend[]>();
		for (const backend of liveBackends) {
			if (backend.state === EXPOSURE_BACKEND_STATE.DRAINING) continue;
			const related = relatedByExposureId.get(backend.exposureId) ?? [];
			related.push(backend);
			relatedByExposureId.set(backend.exposureId, related);
		}

		const changed = new Map<string, ExposureBackend>();
		const activatedExposureIds = new Set<string>();
		for (const backend of candidates) {
			const exposure = exposureById.get(backend.exposureId);
			const predecessors = relatedByExposureId.get(backend.exposureId) ?? [];
			const changedBackends = this.activate(
				exposure,
				backend,
				predecessors,
				observedAt
			);
			if (changedBackends.length > 0) {
				activatedExposureIds.add(backend.exposureId);
			}
			for (const changedBackend of changedBackends) {
				changed.set(changedBackend.id, changedBackend);
			}
		}
		this.wakes.notifyAfterCommit(
			manager,
			NETWORK_WAKE_TOPIC.EXPOSURE_ACTIVATION,
			activatedExposureIds
		);
		await this.versions.bumpEdges(
			manager,
			[...changed.values()].map((backend) => backend.edgeId),
			observedAt
		);
		await this.versions.bumpMachines(
			manager,
			[...changed.values()].map((backend) => backend.machineId),
			observedAt
		);
	}

	private requestDnsActivation(
		manager: EntityManager,
		candidates: readonly ExposureBackend[]
	): void {
		const awaitingDns = candidates.some(
			(backend) =>
				backend.protocol === NETWORK_PROTOCOL.HTTP && !backend.dnsActivatedAt
		);
		if (!awaitingDns) return;
		this.commitHooks.runAfterCommit(manager, () => {
			this.events.emit(NetworkingEvents.EXPOSURE_DNS_ACTIVATION_REQUESTED);
		});
	}

	private activate(
		exposure: Exposure | undefined,
		backend: ExposureBackend,
		predecessors: ExposureBackend[],
		observedAt: Date
	): ExposureBackend[] {
		if (backend.state !== EXPOSURE_BACKEND_STATE.PENDING) return [];
		if (
			backend.protocol === NETWORK_PROTOCOL.HTTP &&
			(!backend.dnsActivatedAt || !backend.dnsTargetHost)
		) {
			return [];
		}
		if (
			!exposure ||
			exposure.desiredState !== EXPOSURE_DESIRED_STATE.ACTIVE ||
			exposure.generation !== backend.exposureGeneration
		) {
			return [];
		}
		if (!exposureCutoverAllowsActivation(backend, predecessors)) return [];

		backend.state = EXPOSURE_BACKEND_STATE.ACTIVE;
		backend.activatedAt = observedAt;
		backend.failureReason = null;
		const drainDeadline = addMilliseconds(
			observedAt,
			NETWORKING_RECONCILIATION.drainDurationMilliseconds
		);
		for (const predecessor of predecessors) {
			if (predecessor.id === backend.id) continue;
			predecessor.state = EXPOSURE_BACKEND_STATE.DRAINING;
			predecessor.drainingAt = observedAt;
			predecessor.drainDeadline = drainDeadline;
		}
		exposure.observedState = EXPOSURE_OBSERVED_STATE.ACTIVE;
		exposure.lastError = null;
		return predecessors;
	}
}
