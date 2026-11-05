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
import { Injectable } from '@nestjs/common';
import type { SandboxPlacement } from '../../../sandbox/entities/sandbox-placement.entity';
import {
	ACTIVE_BACKEND_STATES,
	EXPOSURE_BACKEND_STATE,
} from '../../constants/exposure.constants';
import { LIVE_BINDING_STATES } from '../../constants/machine-tunnel.constants';
import type { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';
import { findServingPlacement } from '../../utils/exposure/exposure-serving-placement.util';
import {
	findLiveBackends,
	lockBindings,
	lockLiveBackends,
	lockNetworkScope,
	networkScopeOf,
} from '../../utils/network-lock.util';
import { EdgePlacementService } from '../edge/edge-placement.service';

export type LockedMaterialization = Awaited<
	ReturnType<ExposureMaterializationLockService['lock']>
>;

@Injectable()
export class ExposureMaterializationLockService {
	constructor(private readonly edgePlacement: EdgePlacementService) {}

	async lock(
		manager: EntityManager,
		exposure: Exposure,
		planned: SandboxPlacement,
		observedAt: Date
	) {
		const plannedBackends = await findLiveBackends(manager, [exposure.id]);
		const preferred = plannedBackends.find(
			(backend) =>
				backend.machineId === planned.machineId &&
				backend.exposureGeneration === exposure.generation &&
				backend.state !== EXPOSURE_BACKEND_STATE.DRAINING
		);
		const selected = await this.edgePlacement.select(
			manager,
			exposure,
			planned.machineId,
			observedAt,
			preferred?.edgeId
		);
		if (!selected) {
			throw new Error('No healthy Edge has compatible placement capacity');
		}
		const backendScope = networkScopeOf(plannedBackends);
		const { machines, edges } = await lockNetworkScope(manager, {
			machineIds: [planned.machineId, ...backendScope.machineIds],
			edgeIds: [selected.id, ...backendScope.edgeIds],
		});
		const placement = await findServingPlacement(
			manager,
			exposure,
			LockMode.PESSIMISTIC_READ
		);
		if (placement?.id !== planned.id) {
			throw new Error('Sandbox placement changed during reconciliation');
		}
		const machine = machines.find(({ id }) => id === placement.machineId);
		if (
			!machine ||
			machine.sessionGeneration <= 0 ||
			!machine.sessionExpiresAt ||
			machine.sessionExpiresAt <= observedAt
		) {
			throw new Error('Sandbox Machine has no active control session');
		}
		const edge = edges.find(({ id }) => id === selected.id);
		if (!edge) throw new Error('Selected Edge is no longer available');

		const liveBinding = await manager.findOne(MachineEdgeBinding, {
			machineId: machine.id,
			edgeId: edge.id,
			observedState: { $in: [...LIVE_BINDING_STATES] },
		});
		const lockedBindings = await lockBindings(
			manager,
			[
				...(liveBinding ? [liveBinding.id] : []),
				...plannedBackends.map((backend) => backend.bindingId),
			],
			{ observedState: { $in: [...LIVE_BINDING_STATES] } }
		);
		const binding =
			lockedBindings.find((locked) => locked.id === liveBinding?.id) ?? null;
		const plannedBindingBackends = binding
			? await manager.find(ExposureBackend, {
					bindingId: binding.id,
					state: { $in: [...ACTIVE_BACKEND_STATES] },
				})
			: [];
		const lockedBackends = new Set(
			await lockLiveBackends(manager, [
				...plannedBackends,
				...plannedBindingBackends,
			])
		);
		return {
			placement,
			machine,
			edge,
			liveBackends: plannedBackends.filter((backend) =>
				lockedBackends.has(backend)
			),
			binding,
			bindingBackends: plannedBindingBackends.filter((backend) =>
				lockedBackends.has(backend)
			),
		};
	}
}
