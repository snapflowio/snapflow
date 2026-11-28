/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { addMilliseconds } from '../../../common/utils/time.util';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_OBSERVED_STATE,
} from '../../constants/exposure.constants';
import {
	NETWORK_PROTOCOL,
	NETWORKING_RECONCILIATION,
} from '../../constants/networking.constants';
import { CustomDomain } from '../../entities/custom-domain.entity';
import type { Exposure } from '../../entities/exposure.entity';
import { lockExposureNetwork } from '../../utils/network-lock.util';
import { MachineBindingTargetService } from '../machine-tunnel/machine-binding-target.service';
import { NetworkControlVersionService } from '../network-control-version.service';

@Injectable()
export class ExposureDeactivationService {
	constructor(
		private readonly versions: NetworkControlVersionService,
		private readonly bindingTargets: MachineBindingTargetService
	) {}

	async deactivate(
		manager: EntityManager,
		exposure: Exposure,
		observedAt: Date
	): Promise<Date | null> {
		const { backends } = await lockExposureNetwork(manager, [exposure.id]);
		if (backends.length === 0) {
			return this.settleWithoutBackends(manager, exposure, observedAt);
		}

		const drainDeadline = addMilliseconds(
			observedAt,
			NETWORKING_RECONCILIATION.drainDurationMilliseconds
		);
		let nextCheckAt: number | undefined;
		for (const backend of backends) {
			if (backend.state !== EXPOSURE_BACKEND_STATE.DRAINING) {
				backend.state = EXPOSURE_BACKEND_STATE.DRAINING;
				backend.drainingAt = observedAt;
				backend.drainDeadline = drainDeadline;
			}
			if (backend.drainDeadline && backend.drainDeadline > observedAt) {
				const deadline = backend.drainDeadline.getTime();
				nextCheckAt =
					nextCheckAt === undefined
						? deadline
						: Math.min(nextCheckAt, deadline);
				continue;
			}
			backend.state = EXPOSURE_BACKEND_STATE.RELEASED;
			backend.releasedAt = observedAt;
		}
		await manager.flush();
		await this.bindingTargets.reviseOrRelease(
			manager,
			backends.map((backend) => backend.bindingId),
			observedAt
		);
		await this.versions.bumpEdges(
			manager,
			backends.map((backend) => backend.edgeId),
			observedAt
		);
		await this.versions.bumpMachines(
			manager,
			backends.map((backend) => backend.machineId),
			observedAt
		);
		if (nextCheckAt !== undefined) return new Date(nextCheckAt);
		if (exposure.desiredState === EXPOSURE_DESIRED_STATE.DELETING) {
			return this.retryAfterBaseDelay(observedAt);
		}
		return null;
	}

	private async settleWithoutBackends(
		manager: EntityManager,
		exposure: Exposure,
		observedAt: Date
	): Promise<Date | null> {
		if (exposure.desiredState === EXPOSURE_DESIRED_STATE.DELETED) {
			exposure.observedState = EXPOSURE_OBSERVED_STATE.DELETED;
			exposure.lastError = null;
			return null;
		}
		if (exposure.desiredState !== EXPOSURE_DESIRED_STATE.DELETING) {
			exposure.observedState = EXPOSURE_OBSERVED_STATE.PENDING;
			return null;
		}
		if (
			exposure.protocol === NETWORK_PROTOCOL.HTTP &&
			!exposure.managedDnsDeletedAt
		) {
			return this.retryAfterBaseDelay(observedAt);
		}
		const customDomain = await manager.findOne(
			CustomDomain,
			{ exposureId: exposure.id },
			{ fields: ['id'], disableIdentityMap: true }
		);
		if (customDomain) return this.retryAfterBaseDelay(observedAt);
		exposure.desiredState = EXPOSURE_DESIRED_STATE.DELETED;
		exposure.observedState = EXPOSURE_OBSERVED_STATE.DELETED;
		exposure.lastError = null;
		return null;
	}

	private retryAfterBaseDelay(observedAt: Date): Date {
		return addMilliseconds(
			observedAt,
			NETWORKING_RECONCILIATION.baseRetryDelayMilliseconds
		);
	}
}
