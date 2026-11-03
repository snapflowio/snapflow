/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { canonicalJson } from '../../../../common/utils/canonical-json.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { runSerializableTransaction } from '../../../../infra/database/utils/serializable-transaction.util';
import { Machine } from '../../../../sandbox/machine/entities/machine.entity';
import { MachineSession } from '../../../../sandbox/machine/entities/machine-session.entity';
import { MachineSessionService } from '../../../../sandbox/machine/services/machine-session.service';
import { EDGE_CONTROL_LIMITS } from '../../constants/edge.constants';
import { ACTIVE_BACKEND_STATES } from '../../constants/exposure.constants';
import { LIVE_BINDING_STATES } from '../../constants/machine-tunnel.constants';
import type {
	MachineTunnelBindingDto,
	MachineTunnelPlanDto,
	MachineTunnelTargetDto,
} from '../../dto/machine-tunnel-plan.dto';
import { Edge } from '../../entities/edge.entity';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';
import { machineTunnelTargetDto } from '../../utils/machine-tunnel/machine-tunnel-target.util';
import { ControlSnapshotRefreshService } from '../control-snapshot-refresh.service';
import { MachineBindingTargetService } from './machine-binding-target.service';

type PlanWithoutDigest = Omit<MachineTunnelPlanDto, 'digest'>;

@Injectable()
export class MachineTunnelPlanService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessions: MachineSessionService,
		private readonly snapshotRefresh: ControlSnapshotRefreshService,
		private readonly bindingTargets: MachineBindingTargetService
	) {}

	async build(
		machineId: string,
		session: MachineSession
	): Promise<MachineTunnelPlanDto> {
		await this.bindingTargets.releaseLapsed(machineId);
		await this.snapshotRefresh.refreshMachineIfStale(machineId);
		return runSerializableTransaction(this.entityManager, async (manager) => {
			const observedAt = await databaseNow(manager);
			await this.machineSessions.assertCurrent(
				manager,
				machineId,
				session.id,
				observedAt
			);
			const machine = await manager.findOne(Machine, { id: machineId });
			if (!machine || session.generation !== machine.sessionGeneration) {
				throw new ConflictException('Machine tunnel plan has been fenced');
			}

			const bindings = await this.liveBindings(
				manager,
				machineId,
				session.generation,
				observedAt
			);
			const backends = await this.liveBackends(
				manager,
				machineId,
				session.generation,
				bindings.map(({ id }) => id),
				observedAt
			);
			const targetsByBinding = await this.targetsByBinding(manager, backends);
			const edgesById = await this.edgesById(manager, bindings);
			const generatedAt = machine.tunnelPlanGeneratedAt;
			const plan: PlanWithoutDigest = {
				machineId,
				machineSessionGeneration: session.generation,
				version: machine.tunnelPlanVersion,
				generatedAt: generatedAt.toISOString(),
				expiresAt: this.expiry(
					generatedAt,
					session,
					bindings,
					backends
				).toISOString(),
				bindings: bindings.map((binding) => {
					const edge = edgesById.get(binding.edgeId);
					if (!edge) {
						throw new ConflictException(
							`Machine binding ${binding.id} has no Edge relation`
						);
					}
					return this.bindingDto(
						binding,
						edge,
						targetsByBinding.get(binding.id) ?? []
					);
				}),
			};
			return {
				...plan,
				digest: createHash('sha256').update(canonicalJson(plan)).digest('hex'),
			};
		});
	}

	private async liveBindings(
		manager: EntityManager,
		machineId: string,
		sessionGeneration: number,
		observedAt: Date
	): Promise<MachineEdgeBinding[]> {
		const bindings = await manager.find(
			MachineEdgeBinding,
			{
				machineId,
				machineSessionGeneration: sessionGeneration,
				observedState: { $in: [...LIVE_BINDING_STATES] },
				leaseExpiresAt: { $gt: observedAt },
			},
			{ orderBy: { edgeId: 'ASC', revision: 'ASC', id: 'ASC' } }
		);
		if (bindings.length > EDGE_CONTROL_LIMITS.maximumBindingsPerSnapshot) {
			throw new ConflictException(
				'Machine binding count exceeds the tunnel-plan limit'
			);
		}
		return bindings;
	}

	private async liveBackends(
		manager: EntityManager,
		machineId: string,
		sessionGeneration: number,
		bindingIds: readonly string[],
		observedAt: Date
	): Promise<ExposureBackend[]> {
		if (bindingIds.length === 0) return [];
		const backends = await manager.find(
			ExposureBackend,
			{
				machineId,
				machineSessionGeneration: sessionGeneration,
				bindingId: { $in: [...bindingIds] },
				state: { $in: [...ACTIVE_BACKEND_STATES] },
				leaseExpiresAt: { $gt: observedAt },
			},
			{ orderBy: { bindingId: 'ASC', id: 'ASC' } }
		);
		if (backends.length > EDGE_CONTROL_LIMITS.maximumRoutesPerSnapshot) {
			throw new ConflictException(
				'Machine target count exceeds the tunnel-plan limit'
			);
		}
		return backends;
	}

	private async edgesById(
		manager: EntityManager,
		bindings: readonly MachineEdgeBinding[]
	): Promise<Map<string, Edge>> {
		if (bindings.length === 0) return new Map();
		const edges = await manager.find(Edge, {
			id: { $in: bindings.map(({ edgeId }) => edgeId) },
		});
		return new Map(edges.map((edge) => [edge.id, edge]));
	}

	private async targetsByBinding(
		manager: EntityManager,
		backends: readonly ExposureBackend[]
	): Promise<Map<string, MachineTunnelTargetDto[]>> {
		const targetsByBinding = new Map<string, MachineTunnelTargetDto[]>();
		if (backends.length === 0) return targetsByBinding;
		const exposures = await manager.find(Exposure, {
			id: { $in: backends.map(({ exposureId }) => exposureId) },
		});
		const exposuresById = new Map(
			exposures.map((exposure) => [exposure.id, exposure])
		);
		for (const backend of backends) {
			const exposure = exposuresById.get(backend.exposureId);
			if (!exposure) {
				throw new ConflictException(
					`Machine backend ${backend.id} has no exposure`
				);
			}
			const targets = targetsByBinding.get(backend.bindingId) ?? [];
			targets.push(machineTunnelTargetDto(backend, exposure));
			targetsByBinding.set(backend.bindingId, targets);
		}
		return targetsByBinding;
	}

	private bindingDto(
		binding: MachineEdgeBinding,
		edge: Edge,
		targets: MachineTunnelTargetDto[]
	): MachineTunnelBindingDto {
		return {
			edgeId: edge.id,
			edgeHost: edge.tunnelAddress.host,
			edgePort: edge.tunnelAddress.port,
			bindingId: binding.id,
			bindingRevision: binding.revision,
			bindingDigest: binding.digest,
			targetRevision: binding.targetRevision,
			targetDigest: binding.targetDigest,
			desiredState: binding.desiredState,
			leaseExpiresAt: binding.leaseExpiresAt.toISOString(),
			targets,
		};
	}

	private expiry(
		generatedAt: Date,
		session: MachineSession,
		bindings: readonly MachineEdgeBinding[],
		backends: readonly ExposureBackend[]
	): Date {
		const maximumExpiry =
			generatedAt.getTime() +
			EDGE_CONTROL_LIMITS.routeSnapshotLifetimeMilliseconds;
		return new Date(
			Math.min(
				maximumExpiry,
				session.expiresAt.getTime(),
				...bindings.map((binding) => binding.leaseExpiresAt.getTime()),
				...backends.map((backend) => backend.leaseExpiresAt.getTime())
			)
		);
	}
}
