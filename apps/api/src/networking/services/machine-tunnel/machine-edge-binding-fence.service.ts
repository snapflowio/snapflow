/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { Machine } from '../../../machine/entities/machine.entity';
import {
	MACHINE_EDGE_BINDING_DESIRED_STATE,
	MACHINE_EDGE_BINDING_STATE,
} from '../../constants/machine-tunnel.constants';
import { NETWORKING_LIMITS } from '../../constants/networking.constants';
import type { Edge } from '../../entities/edge.entity';
import type { Exposure } from '../../entities/exposure.entity';
import type { ExposureBackend } from '../../entities/exposure-backend.entity';
import { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';
import {
	machineBindingDigest,
	machineTargetPlanDigest,
} from '../../utils/machine-tunnel/machine-binding-digest.util';
import { MachineBindingTargetService } from './machine-binding-target.service';

const INITIAL_BINDING_REVISION = 1;
const INITIAL_TARGET_REVISION = 1;

@Injectable()
export class MachineEdgeBindingFenceService {
	constructor(private readonly bindingTargets: MachineBindingTargetService) {}

	create(
		manager: EntityManager,
		machine: Machine,
		edge: Edge,
		observedAt: Date,
		leaseExpiresAt: Date
	): MachineEdgeBinding {
		const bindingId = randomUUID();
		const binding = manager.create(MachineEdgeBinding, {
			id: bindingId,
			machineId: machine.id,
			edgeId: edge.id,
			machineSessionGeneration: machine.sessionGeneration,
			desiredState: MACHINE_EDGE_BINDING_DESIRED_STATE.ACTIVE,
			observedState: MACHINE_EDGE_BINDING_STATE.PENDING,
			revision: INITIAL_BINDING_REVISION,
			digest: machineBindingDigest(
				machine.id,
				edge.id,
				machine.sessionGeneration,
				INITIAL_BINDING_REVISION
			),
			targetRevision: INITIAL_TARGET_REVISION,
			targetDigest: machineTargetPlanDigest(
				bindingId,
				INITIAL_BINDING_REVISION,
				INITIAL_TARGET_REVISION,
				[]
			),
			leaseExpiresAt,
			lastAcknowledgedAt: null,
			activeConnectionId: null,
			replacementConnectionId: null,
			observedRttMilliseconds: null,
			observedLossRatio: null,
			observedCarrier: null,
			lastError: null,
			drainingAt: null,
			releasedAt: null,
			createdAt: observedAt,
			updatedAt: observedAt,
		});
		manager.persist(binding);
		return binding;
	}

	async fence(
		manager: EntityManager,
		exposure: Exposure,
		machine: Machine,
		binding: MachineEdgeBinding,
		bindingExists: boolean,
		targets: readonly ExposureBackend[]
	): Promise<void> {
		const expectedBindingDigest = machineBindingDigest(
			machine.id,
			binding.edgeId,
			machine.sessionGeneration,
			binding.revision
		);
		const bindingIsCurrent =
			bindingExists &&
			binding.machineSessionGeneration === machine.sessionGeneration &&
			binding.desiredState === MACHINE_EDGE_BINDING_DESIRED_STATE.ACTIVE &&
			binding.digest === expectedBindingDigest;
		if (!bindingIsCurrent) {
			this.revise(machine, binding, bindingExists);
		}
		const targetDtos = await this.bindingTargets.targetDtos(
			manager,
			targets,
			exposure
		);
		const expectedTargetDigest = machineTargetPlanDigest(
			binding.id,
			binding.revision,
			binding.targetRevision,
			targetDtos
		);
		const targetPlanIsCurrent =
			bindingIsCurrent && binding.targetDigest === expectedTargetDigest;
		if (!targetPlanIsCurrent) {
			const nextTargetRevision = bindingExists
				? binding.targetRevision + 1
				: binding.targetRevision;
			if (nextTargetRevision > NETWORKING_LIMITS.maximumBindingRevision) {
				throw new Error('Machine target plan revision is exhausted');
			}
			binding.targetRevision = nextTargetRevision;
			binding.targetDigest = machineTargetPlanDigest(
				binding.id,
				binding.revision,
				nextTargetRevision,
				targetDtos
			);
		}
		for (const target of targets) {
			if (
				target.bindingDigest !== binding.digest ||
				target.targetDigest !== binding.targetDigest
			) {
				target.machineAcknowledgedAt = null;
			}
			target.machineSessionGeneration = machine.sessionGeneration;
			target.bindingRevision = binding.revision;
			target.bindingDigest = binding.digest;
			target.targetRevision = binding.targetRevision;
			target.targetDigest = binding.targetDigest;
		}
	}

	private revise(
		machine: Machine,
		binding: MachineEdgeBinding,
		bindingExists: boolean
	): void {
		const machineSessionChanged =
			binding.machineSessionGeneration !== machine.sessionGeneration;
		const nextRevision = bindingExists
			? binding.revision + 1
			: binding.revision;
		if (nextRevision > NETWORKING_LIMITS.maximumBindingRevision) {
			throw new Error('Machine Edge binding revision is exhausted');
		}
		binding.machineSessionGeneration = machine.sessionGeneration;
		binding.desiredState = MACHINE_EDGE_BINDING_DESIRED_STATE.ACTIVE;
		binding.observedState =
			!machineSessionChanged && binding.activeConnectionId
				? MACHINE_EDGE_BINDING_STATE.REPLACING
				: MACHINE_EDGE_BINDING_STATE.PENDING;
		if (machineSessionChanged) binding.activeConnectionId = null;
		binding.revision = nextRevision;
		binding.digest = machineBindingDigest(
			machine.id,
			binding.edgeId,
			machine.sessionGeneration,
			nextRevision
		);
		binding.replacementConnectionId = null;
		binding.lastError = null;
		binding.drainingAt = null;
		binding.releasedAt = null;
	}
}
