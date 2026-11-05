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
	NotFoundException,
} from '@nestjs/common';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_CUTOVER,
} from '../../constants/exposure.constants';
import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import type { Edge } from '../../entities/edge.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import type { ExposureCutoverPair } from '../../types/exposure-cutover.types';
import { exposureCutoverPredecessor } from '../../utils/exposure/exposure-cutover.util';
import { lockExposureNetwork } from '../../utils/network-lock.util';
import { MachineBindingTargetService } from '../machine-tunnel/machine-binding-target.service';
import { NetworkControlVersionService } from '../network-control-version.service';
import { ExposureActivationService } from './exposure-activation.service';
import { ExposureManagedDnsService } from './exposure-managed-dns.service';

type LockedCutover = Awaited<ReturnType<ExposureCutoverService['lockCutover']>>;
type RollbackTarget = Awaited<
	ReturnType<ExposureCutoverService['fenceRollback']>
>;

@Injectable()
export class ExposureCutoverService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly activation: ExposureActivationService,
		private readonly managedDns: ExposureManagedDnsService,
		private readonly versions: NetworkControlVersionService,
		private readonly bindingTargets: MachineBindingTargetService
	) {}

	async list(): Promise<ExposureCutoverPair[]> {
		const observedAt = await databaseNow(this.entityManager);
		const candidates = await this.entityManager.find(
			ExposureBackend,
			{
				protocol: NETWORK_PROTOCOL.HTTP,
				state: EXPOSURE_BACKEND_STATE.PENDING,
				edgeAcknowledgedAt: { $ne: null },
				machineAcknowledgedAt: { $ne: null },
				leaseExpiresAt: { $gt: observedAt },
			},
			{
				orderBy: { createdAt: 'ASC', id: 'ASC' },
				limit: EXPOSURE_CUTOVER.maximumListSize,
			}
		);
		if (candidates.length === 0) return [];

		const predecessors = await this.entityManager.find(
			ExposureBackend,
			{
				exposureId: {
					$in: candidates.map((backend) => backend.exposureId),
				},
				state: EXPOSURE_BACKEND_STATE.ACTIVE,
				edgeAcknowledgedAt: { $ne: null },
				machineAcknowledgedAt: { $ne: null },
				leaseExpiresAt: { $gt: observedAt },
			},
			{ orderBy: { createdAt: 'ASC', id: 'ASC' } }
		);

		return candidates.flatMap((candidate) => {
			const predecessor = exposureCutoverPredecessor(candidate, predecessors);
			return predecessor ? [{ candidate, predecessor }] : [];
		});
	}

	async begin(backendId: string): Promise<ExposureCutoverPair> {
		return this.entityManager.transactional(
			async (manager) => {
				const cutover = await this.lockCutover(manager, backendId);
				if (!cutover.candidate.cutoverStartedAt) {
					cutover.candidate.cutoverStartedAt = cutover.observedAt;
					cutover.candidate.cutoverVerifiedAt = null;
				}
				return {
					candidate: cutover.candidate,
					predecessor: cutover.predecessor,
				};
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async verify(backendId: string): Promise<ExposureCutoverPair> {
		return this.entityManager.transactional(
			async (manager) => {
				const cutover = await this.lockCutover(manager, backendId);
				if (!cutover.candidate.cutoverStartedAt) {
					throw new ConflictException('Exposure cutover has not started');
				}
				if (!cutover.candidate.dnsActivatedAt) {
					throw new ConflictException('Exposure cutover DNS is not active');
				}
				cutover.candidate.cutoverVerifiedAt ??= cutover.observedAt;
				await manager.flush();
				await this.activation.activateReadyBackend(
					manager,
					cutover.candidate.id
				);
				const activated = await manager.findOneOrFail(ExposureBackend, {
					id: cutover.candidate.id,
				});
				return { candidate: activated, predecessor: cutover.predecessor };
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async rollback(backendId: string): Promise<ExposureCutoverPair> {
		const target = await this.entityManager.transactional(
			(manager) => this.fenceRollback(manager, backendId),
			{ propagation: TransactionPropagation.REQUIRED }
		);
		await this.managedDns.pointAt(target.exposure, target.edge);
		return this.entityManager.transactional(
			(manager) => this.completeRollback(manager, backendId, target),
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async fenceRollback(manager: EntityManager, backendId: string) {
		const cutover = await this.lockCutover(manager, backendId);
		if (!cutover.candidate.cutoverStartedAt) {
			throw new ConflictException('Exposure cutover has not started');
		}
		if (cutover.candidate.cutoverVerifiedAt) {
			throw new ConflictException(
				'A verified exposure cutover cannot be rolled back'
			);
		}
		const edge = this.predecessorEdge(cutover);
		cutover.candidate.cutoverStartedAt = null;
		cutover.candidate.dnsActivatedAt = null;
		return {
			exposure: cutover.exposure,
			edge,
			predecessorId: cutover.predecessor.id,
		};
	}

	private async completeRollback(
		manager: EntityManager,
		backendId: string,
		target: RollbackTarget
	): Promise<ExposureCutoverPair> {
		const cutover = await this.lockCutover(manager, backendId);
		const edge = this.predecessorEdge(cutover);
		if (
			cutover.candidate.cutoverStartedAt ||
			cutover.predecessor.id !== target.predecessorId ||
			edge.publicHost !== target.edge.publicHost
		) {
			throw new ConflictException(
				'Exposure cutover changed during its rollback; the candidate awaits a new cutover'
			);
		}
		cutover.candidate.state = EXPOSURE_BACKEND_STATE.RELEASED;
		cutover.candidate.releasedAt = cutover.observedAt;
		cutover.candidate.failureReason = EXPOSURE_CUTOVER.rollbackFailureReason;
		cutover.predecessor.dnsTargetHost = edge.publicHost;
		cutover.predecessor.dnsActivatedAt = cutover.observedAt;
		await manager.flush();
		await this.bindingTargets.reviseOrRelease(
			manager,
			[cutover.candidate.bindingId],
			cutover.observedAt
		);
		await this.versions.bumpEdges(
			manager,
			[cutover.candidate.edgeId, cutover.predecessor.edgeId],
			cutover.observedAt
		);
		await this.versions.bumpMachines(
			manager,
			[cutover.candidate.machineId],
			cutover.observedAt
		);
		return { candidate: cutover.candidate, predecessor: cutover.predecessor };
	}

	private predecessorEdge(cutover: LockedCutover): Edge {
		const edge = cutover.edges.find(
			({ id }) => id === cutover.predecessor.edgeId
		);
		if (!edge) {
			throw new ConflictException(
				'Exposure cutover predecessor Edge is unavailable'
			);
		}
		return edge;
	}

	private async lockCutover(manager: EntityManager, backendId: string) {
		const snapshot = await manager.findOne(
			ExposureBackend,
			{ id: backendId },
			{ fields: ['exposureId'], disableIdentityMap: true }
		);
		if (!snapshot) throw new NotFoundException('Exposure backend not found');
		const network = await lockExposureNetwork(manager, [snapshot.exposureId]);
		const [exposure] = network.exposures;
		if (!exposure) throw new NotFoundException('Exposure not found');
		const observedAt = await databaseNow(manager);
		const backends = network.backends.filter(
			(backend) => backend.state !== EXPOSURE_BACKEND_STATE.DRAINING
		);
		const candidate = backends.find((backend) => backend.id === backendId);
		if (!candidate || candidate.state !== EXPOSURE_BACKEND_STATE.PENDING) {
			throw new ConflictException(
				'Exposure cutover candidate is no longer pending'
			);
		}
		if (
			candidate.protocol !== NETWORK_PROTOCOL.HTTP ||
			candidate.exposureGeneration !== exposure.generation
		) {
			throw new ConflictException('Exposure cutover candidate has been fenced');
		}
		const predecessor = exposureCutoverPredecessor(candidate, backends);
		if (!predecessor) {
			throw new ConflictException('Exposure cutover has no active predecessor');
		}
		this.assertAcknowledgedAndLive(candidate, observedAt, 'candidate');
		this.assertAcknowledgedAndLive(predecessor, observedAt, 'predecessor');
		return {
			candidate,
			edges: network.edges,
			exposure,
			observedAt,
			predecessor,
		};
	}

	private assertAcknowledgedAndLive(
		backend: ExposureBackend,
		observedAt: Date,
		role: 'candidate' | 'predecessor'
	): void {
		if (
			!backend.edgeAcknowledgedAt ||
			!backend.machineAcknowledgedAt ||
			backend.leaseExpiresAt <= observedAt
		) {
			throw new ConflictException(
				`Exposure cutover ${role} is not fully acknowledged and live`
			);
		}
	}
}
