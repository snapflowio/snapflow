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
import { Injectable } from '@nestjs/common';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import {
	ACTIVE_BACKEND_STATES,
	EXPOSURE_BACKEND_STATE,
} from '../../constants/exposure.constants';
import {
	LIVE_BINDING_STATES,
	MACHINE_EDGE_BINDING_DESIRED_STATE,
	MACHINE_EDGE_BINDING_STATE,
} from '../../constants/machine-tunnel.constants';
import { NETWORKING_LIMITS } from '../../constants/networking.constants';
import type { MachineTunnelTargetDto } from '../../dto/machine-tunnel-plan.dto';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import type { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';
import { machineTargetPlanDigest } from '../../utils/machine-tunnel/machine-binding-digest.util';
import { machineTunnelTargetDto } from '../../utils/machine-tunnel/machine-tunnel-target.util';
import {
	lockBackends,
	lockBindings,
	lockLiveBackends,
	lockNetworkScope,
} from '../../utils/network-lock.util';
import { NetworkControlVersionService } from '../network-control-version.service';

const LAPSED_BACKEND_FAILURE_REASON =
	'Exposure backend lease lapsed without renewal';

@Injectable()
export class MachineBindingTargetService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly versions: NetworkControlVersionService
	) {}

	async releaseLapsed(machineId: string): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const observedAt = await databaseNow(manager);
				const lapsedFilter = {
					machineId,
					state: { $in: [...ACTIVE_BACKEND_STATES] },
					leaseExpiresAt: { $lte: observedAt },
				};
				const planned = await manager.find(ExposureBackend, lapsedFilter);
				if (planned.length === 0) return;
				await lockNetworkScope(manager, {
					machineIds: [machineId],
					edgeIds: planned.map((backend) => backend.edgeId),
				});
				await lockBindings(
					manager,
					planned.map((backend) => backend.bindingId)
				);
				const lapsed = await lockBackends(
					manager,
					planned.map((backend) => backend.id),
					lapsedFilter
				);
				if (lapsed.length === 0) return;
				for (const backend of lapsed) {
					backend.state = EXPOSURE_BACKEND_STATE.RELEASED;
					backend.drainingAt ??= observedAt;
					backend.drainDeadline = null;
					backend.releasedAt = observedAt;
					backend.failureReason = LAPSED_BACKEND_FAILURE_REASON;
				}
				await manager.flush();
				await this.reviseOrRelease(
					manager,
					lapsed.map((backend) => backend.bindingId),
					observedAt
				);
				await this.versions.bumpEdges(
					manager,
					lapsed.map((backend) => backend.edgeId),
					observedAt
				);
				await this.versions.bumpMachines(manager, [machineId], observedAt);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async reviseOrRelease(
		manager: EntityManager,
		bindingIds: readonly string[],
		observedAt: Date
	): Promise<void> {
		const uniqueBindingIds = [...new Set(bindingIds)];
		if (uniqueBindingIds.length === 0) return;
		const bindings = await lockBindings(manager, uniqueBindingIds, {
			observedState: { $in: [...LIVE_BINDING_STATES] },
		});
		const remainingBackends = await lockLiveBackends(
			manager,
			await manager.find(ExposureBackend, {
				bindingId: { $in: uniqueBindingIds },
				state: { $in: [...ACTIVE_BACKEND_STATES] },
			})
		);
		const targets = await this.targetDtos(manager, remainingBackends);
		const remainingByBindingId = new Map<string, ExposureBackend[]>();
		const targetsByBindingId = new Map<string, MachineTunnelTargetDto[]>();
		for (const [index, backend] of remainingBackends.entries()) {
			const remaining = remainingByBindingId.get(backend.bindingId) ?? [];
			remaining.push(backend);
			remainingByBindingId.set(backend.bindingId, remaining);
			const bindingTargets = targetsByBindingId.get(backend.bindingId) ?? [];
			bindingTargets.push(targets[index]);
			targetsByBindingId.set(backend.bindingId, bindingTargets);
		}
		for (const binding of bindings) {
			const remaining = remainingByBindingId.get(binding.id) ?? [];
			if (remaining.length === 0) {
				this.release(binding, observedAt);
				continue;
			}
			this.refence(
				binding,
				remaining,
				targetsByBindingId.get(binding.id) ?? []
			);
		}
	}

	async targetDtos(
		manager: EntityManager,
		backends: readonly ExposureBackend[],
		knownExposure?: Exposure
	): Promise<MachineTunnelTargetDto[]> {
		const exposureIds = [
			...new Set(
				backends
					.map((backend) => backend.exposureId)
					.filter((id) => id !== knownExposure?.id)
			),
		];
		const exposures = exposureIds.length
			? await manager.find(Exposure, { id: { $in: exposureIds } })
			: [];
		const exposureById = new Map(
			[...(knownExposure ? [knownExposure] : []), ...exposures].map(
				(exposure) => [exposure.id, exposure]
			)
		);
		return backends.map((backend) => {
			const exposure = exposureById.get(backend.exposureId);
			if (!exposure) throw new Error('Exposure backend has no exposure');
			return machineTunnelTargetDto(backend, exposure);
		});
	}

	private release(binding: MachineEdgeBinding, observedAt: Date): void {
		binding.desiredState = MACHINE_EDGE_BINDING_DESIRED_STATE.RELEASED;
		binding.observedState = MACHINE_EDGE_BINDING_STATE.RELEASED;
		binding.drainingAt = observedAt;
		binding.releasedAt = observedAt;
		binding.replacementConnectionId = null;
	}

	private refence(
		binding: MachineEdgeBinding,
		remaining: readonly ExposureBackend[],
		targets: readonly MachineTunnelTargetDto[]
	): void {
		const currentDigest = machineTargetPlanDigest(
			binding.id,
			binding.revision,
			binding.targetRevision,
			targets
		);
		if (binding.targetDigest === currentDigest) return;
		if (binding.targetRevision >= NETWORKING_LIMITS.maximumBindingRevision) {
			throw new Error('Machine target plan revision is exhausted');
		}
		binding.targetRevision += 1;
		binding.targetDigest = machineTargetPlanDigest(
			binding.id,
			binding.revision,
			binding.targetRevision,
			targets
		);
		for (const backend of remaining) {
			backend.targetRevision = binding.targetRevision;
			backend.targetDigest = binding.targetDigest;
			backend.machineAcknowledgedAt = null;
		}
	}
}
