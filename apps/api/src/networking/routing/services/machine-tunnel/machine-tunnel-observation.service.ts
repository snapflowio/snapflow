/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type FilterQuery, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import type { MachineSession } from '../../../../sandbox/machine/entities/machine-session.entity';
import { MachineSessionService } from '../../../../sandbox/machine/services/machine-session.service';
import { ACTIVE_BACKEND_STATES } from '../../constants/exposure.constants';
import {
	LIVE_BINDING_STATES,
	MACHINE_EDGE_BINDING_STATE,
} from '../../constants/machine-tunnel.constants';
import type {
	MachineTunnelBindingAcknowledgementDto,
	MachineTunnelBindingAcknowledgementResponseDto,
	MachineTunnelTargetPlanAcknowledgementDto,
	MachineTunnelTargetPlanAcknowledgementResponseDto,
} from '../../dto/machine-tunnel-observation.dto';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';
import { lockBindings, lockEdges } from '../../utils/network-lock.util';
import { ExposureActivationService } from '../exposure/exposure-activation.service';

@Injectable()
export class MachineTunnelObservationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessions: MachineSessionService,
		private readonly exposureActivation: ExposureActivationService
	) {}

	async acknowledge(
		machineId: string,
		session: MachineSession,
		input: MachineTunnelBindingAcknowledgementDto
	): Promise<MachineTunnelBindingAcknowledgementResponseDto> {
		return this.entityManager.transactional(
			async (manager) => {
				const observedAt = await databaseNow(manager);
				await this.machineSessions.assertCurrent(
					manager,
					machineId,
					session.id,
					observedAt
				);
				const binding = await this.lockBinding(manager, input.bindingId, {
					machineId,
					machineSessionGeneration: session.generation,
					revision: input.bindingRevision,
					digest: input.bindingDigest,
					observedState: { $in: [...LIVE_BINDING_STATES] },
					leaseExpiresAt: { $gt: observedAt },
				});
				if (!binding) {
					throw new ConflictException('Machine tunnel binding has been fenced');
				}

				if (binding.activeConnectionId !== input.connectionId) {
					binding.replacementConnectionId = input.connectionId;
					binding.observedState = binding.activeConnectionId
						? MACHINE_EDGE_BINDING_STATE.REPLACING
						: MACHINE_EDGE_BINDING_STATE.PENDING;
				}
				binding.observedCarrier = input.carrier;
				binding.observedRttMilliseconds = input.smoothedRttMilliseconds;
				binding.observedLossRatio = input.lossRatio;
				binding.lastError = null;
				return {
					bindingId: binding.id,
					connectionId: input.connectionId,
					acceptedAt: observedAt.toISOString(),
				};
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async acknowledgeTargetPlan(
		machineId: string,
		session: MachineSession,
		input: MachineTunnelTargetPlanAcknowledgementDto
	): Promise<MachineTunnelTargetPlanAcknowledgementResponseDto> {
		const acknowledgement = await this.entityManager.transactional(
			async (manager) => {
				const observedAt = await databaseNow(manager);
				await this.machineSessions.assertCurrent(
					manager,
					machineId,
					session.id,
					observedAt
				);
				const binding = await this.lockBinding(manager, input.bindingId, {
					machineId,
					machineSessionGeneration: session.generation,
					revision: input.bindingRevision,
					digest: input.bindingDigest,
					targetRevision: input.targetRevision,
					targetDigest: input.targetDigest,
					observedState: { $in: [...LIVE_BINDING_STATES] },
					leaseExpiresAt: { $gt: observedAt },
				});
				if (!binding) {
					throw new ConflictException(
						'Machine tunnel target plan has been fenced'
					);
				}

				await manager.nativeUpdate(
					ExposureBackend,
					{
						bindingId: binding.id,
						bindingRevision: binding.revision,
						bindingDigest: binding.digest,
						targetRevision: binding.targetRevision,
						targetDigest: binding.targetDigest,
						machineId,
						machineSessionGeneration: session.generation,
						state: { $in: [...ACTIVE_BACKEND_STATES] },
					},
					{ machineAcknowledgedAt: observedAt, updatedAt: observedAt }
				);
				return {
					bindingId: binding.id,
					targetRevision: binding.targetRevision,
					acceptedAt: observedAt.toISOString(),
				};
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		await this.exposureActivation.activateReadyForBinding(
			this.entityManager,
			acknowledgement.bindingId
		);
		return acknowledgement;
	}

	private async lockBinding(
		manager: EntityManager,
		bindingId: string,
		where: FilterQuery<MachineEdgeBinding>
	): Promise<MachineEdgeBinding | null> {
		const planned = await manager.findOne(
			MachineEdgeBinding,
			{ $and: [{ id: bindingId }, where] },
			{ fields: ['edgeId'], disableIdentityMap: true }
		);
		if (!planned) return null;
		await lockEdges(manager, [planned.edgeId]);
		const [binding = null] = await lockBindings(manager, [bindingId], where);
		return binding;
	}
}
