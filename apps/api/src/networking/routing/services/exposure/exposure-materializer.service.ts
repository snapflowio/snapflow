/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, randomUUID } from 'node:crypto';
import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { addMilliseconds } from '../../../../common/utils/time.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { SettingsService } from '../../../../settings/platform/services/settings.service';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_OBSERVED_STATE,
} from '../../constants/exposure.constants';
import { MACHINE_EDGE_BINDING_STATE } from '../../constants/machine-tunnel.constants';
import {
	NETWORK_PROTOCOL,
	NETWORKING_RECONCILIATION,
} from '../../constants/networking.constants';
import type { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { PublicIngressDisabledException } from '../../exceptions/public-ingress-disabled.exception';
import { findServingPlacement } from '../../utils/exposure/exposure-serving-placement.util';
import { isPublicExposure } from '../../utils/exposure/public-ingress-policy.util';
import { lockExposures } from '../../utils/network-lock.util';
import { EdgeListenerAllocationService } from '../edge/edge-listener-allocation.service';
import { MachineBindingTargetService } from '../machine-tunnel/machine-binding-target.service';
import { MachineEdgeBindingFenceService } from '../machine-tunnel/machine-edge-binding-fence.service';
import { NetworkControlVersionService } from '../network-control-version.service';
import { ExposureDeactivationService } from './exposure-deactivation.service';
import {
	ExposureMaterializationLockService,
	type LockedMaterialization,
} from './exposure-materialization-lock.service';

const FENCING_TOKEN_HASH_ALGORITHM = 'sha256';

@Injectable()
export class ExposureMaterializerService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly materializationLocks: ExposureMaterializationLockService,
		private readonly listenerAllocation: EdgeListenerAllocationService,
		private readonly bindingFences: MachineEdgeBindingFenceService,
		private readonly deactivation: ExposureDeactivationService,
		private readonly versions: NetworkControlVersionService,
		private readonly bindingTargets: MachineBindingTargetService
	) {}

	async reconcile(exposureId: string): Promise<Date | null> {
		return this.entityManager.transactional(
			async (manager) => {
				const [exposure] = await lockExposures(manager, [exposureId]);
				if (!exposure) return null;
				const observedAt = await databaseNow(manager);
				if (exposure.desiredState !== EXPOSURE_DESIRED_STATE.ACTIVE) {
					return this.deactivation.deactivate(manager, exposure, observedAt);
				}
				if (
					isPublicExposure(exposure) &&
					!(await this.settings.get()).publicIngressEnabled
				) {
					throw new PublicIngressDisabledException();
				}
				const planned = await findServingPlacement(manager, exposure);
				if (!planned) {
					throw new Error('Sandbox has no active placement');
				}
				const locked = await this.materializationLocks.lock(
					manager,
					exposure,
					planned,
					observedAt
				);
				await this.materialize(manager, exposure, locked, observedAt);
				return null;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async materialize(
		manager: EntityManager,
		exposure: Exposure,
		locked: LockedMaterialization,
		observedAt: Date
	): Promise<void> {
		const { placement, machine, edge, liveBackends } = locked;
		const expiredDrains = await this.releaseExpiredDrains(
			manager,
			liveBackends,
			observedAt
		);
		const candidates = liveBackends.filter(
			(backend) => !expiredDrains.includes(backend)
		);
		const backendLeaseExpiresAt = addMilliseconds(
			observedAt,
			NETWORKING_RECONCILIATION.backendLeaseDurationMilliseconds
		);
		const bindingLeaseExpiresAt = addMilliseconds(
			observedAt,
			NETWORKING_RECONCILIATION.bindingLeaseDurationMilliseconds
		);
		let backend = candidates.find((candidate) => candidate.edgeId === edge.id);
		const publicPort = await this.listenerAllocation.allocate(
			manager,
			edge,
			exposure.protocol,
			backend?.publicPort
		);
		const reusableBinding =
			locked.binding?.observedState === MACHINE_EDGE_BINDING_STATE.RELEASED
				? null
				: locked.binding;
		const bindingExists = Boolean(reusableBinding);
		const binding =
			reusableBinding ??
			this.bindingFences.create(
				manager,
				machine,
				edge,
				observedAt,
				bindingLeaseExpiresAt
			);
		const backendExists = Boolean(backend);
		if (!backend) {
			backend = new ExposureBackend();
			backend.id = randomUUID();
		}
		const backendRequiresActivation =
			!backendExists ||
			backend.placementId !== placement.id ||
			backend.exposureGeneration !== exposure.generation ||
			backend.assignmentGeneration !== placement.assignmentGeneration ||
			backend.machineSessionGeneration !== machine.sessionGeneration ||
			backend.protocol !== exposure.protocol ||
			backend.targetPort !== exposure.targetPort;
		const dnsActivationMatchesEdge =
			exposure.protocol === NETWORK_PROTOCOL.HTTP &&
			backend.dnsTargetHost === edge.publicHost
				? backend.dnsActivatedAt
				: null;
		Object.assign(backend, {
			exposureId: exposure.id,
			placementId: placement.id,
			sandboxId: exposure.sandboxId,
			machineId: machine.id,
			edgeId: edge.id,
			bindingId: binding.id,
			exposureGeneration: exposure.generation,
			assignmentGeneration: placement.assignmentGeneration,
			placementFencingTokenHash: this.fencingTokenHash(placement.fencingToken),
			machineSessionGeneration: machine.sessionGeneration,
			protocol: exposure.protocol,
			targetPort: exposure.targetPort,
			publicHost: exposure.platformHostname ?? edge.publicHost,
			publicPort,
			routeTableVersion: edge.routeTableVersion,
			leaseExpiresAt: backendLeaseExpiresAt,
			dnsTargetHost:
				exposure.protocol === NETWORK_PROTOCOL.HTTP ? edge.publicHost : null,
			dnsActivatedAt: dnsActivationMatchesEdge,
		});
		if (backendRequiresActivation) {
			Object.assign(backend, {
				state: EXPOSURE_BACKEND_STATE.PENDING,
				edgeAcknowledgedAt: null,
				cutoverStartedAt: null,
				cutoverVerifiedAt: null,
				activatedAt: null,
				drainingAt: null,
				drainDeadline: null,
				releasedAt: null,
				failureReason: null,
			});
		}

		const targets = (reusableBinding ? locked.bindingBackends : []).filter(
			(candidate) =>
				candidate.id !== backend.id && !expiredDrains.includes(candidate)
		);
		targets.push(backend);
		await this.bindingFences.fence(
			manager,
			exposure,
			machine,
			binding,
			bindingExists,
			targets
		);
		binding.leaseExpiresAt = bindingLeaseExpiresAt;
		for (const target of targets) {
			target.leaseExpiresAt = backendLeaseExpiresAt;
		}
		if (!backendExists) manager.persist(backend);

		if (backendRequiresActivation) {
			exposure.observedState = EXPOSURE_OBSERVED_STATE.PENDING;
		}
		exposure.lastError = null;
		await this.versions.bumpEdges(
			manager,
			[edge.id, ...expiredDrains.map((item) => item.edgeId)],
			observedAt
		);
		await this.versions.bumpMachines(
			manager,
			[machine.id, ...expiredDrains.map((item) => item.machineId)],
			observedAt
		);
	}

	private async releaseExpiredDrains(
		manager: EntityManager,
		liveBackends: readonly ExposureBackend[],
		observedAt: Date
	): Promise<ExposureBackend[]> {
		const expiredDrains = liveBackends.filter(
			(backend) =>
				backend.state === EXPOSURE_BACKEND_STATE.DRAINING &&
				backend.drainDeadline !== null &&
				backend.drainDeadline <= observedAt
		);
		if (expiredDrains.length === 0) return expiredDrains;
		for (const backend of expiredDrains) {
			backend.state = EXPOSURE_BACKEND_STATE.RELEASED;
			backend.releasedAt = observedAt;
		}
		await manager.flush();
		await this.bindingTargets.reviseOrRelease(
			manager,
			expiredDrains.map((backend) => backend.bindingId),
			observedAt
		);
		return expiredDrains;
	}

	private fencingTokenHash(token: string): string {
		return createHash(FENCING_TOKEN_HASH_ALGORITHM).update(token).digest('hex');
	}
}
