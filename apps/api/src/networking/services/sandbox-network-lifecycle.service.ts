/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { raw, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IsolatedEntityManagerContext } from '../../common/decorators/isolated-entity-manager-context.decorator';
import { errorStack } from '../../common/utils/error/error.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SandboxEvents } from '../../sandbox/constants/sandbox-events.constants';
import { SandboxDesiredState } from '../../sandbox/enums/sandbox-desired-state.enum';
import { SandboxDesiredStateUpdatedEvent } from '../../sandbox/events/sandbox-desired-state-updated.event';
import {
	CUSTOM_DOMAIN_STATE,
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_OBSERVED_STATE,
} from '../constants/exposure.constants';
import { CustomDomain } from '../entities/custom-domain.entity';
import {
	lockExposureNetwork,
	lockExposuresWhere,
} from '../utils/network-lock.util';
import { ExposureReconciliationQueueService } from './exposure/exposure-reconciliation-queue.service';
import { MachineBindingTargetService } from './machine-tunnel/machine-binding-target.service';
import { NetworkControlVersionService } from './network-control-version.service';

@Injectable()
export class SandboxNetworkLifecycleService {
	private readonly logger = new Logger(SandboxNetworkLifecycleService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly versions: NetworkControlVersionService,
		private readonly exposureQueue: ExposureReconciliationQueueService,
		private readonly bindingTargets: MachineBindingTargetService
	) {}

	@OnEvent(SandboxEvents.DESIRED_STATE_UPDATED)
	@IsolatedEntityManagerContext()
	async handleDesiredStateUpdate(
		event: SandboxDesiredStateUpdatedEvent
	): Promise<void> {
		if (event.newDesiredState !== SandboxDesiredState.DESTROYED) return;
		try {
			await this.entityManager.transactional(
				async (manager) => {
					const generatedAt = await databaseNow(manager);
					const planned = await lockExposuresWhere(manager, {
						sandboxId: event.sandbox.id,
					});
					const { exposures, backends } = await lockExposureNetwork(
						manager,
						planned.map(({ id }) => id)
					);
					for (const exposure of exposures) {
						if (exposure.desiredState !== EXPOSURE_DESIRED_STATE.DELETING) {
							exposure.desiredState = EXPOSURE_DESIRED_STATE.DELETING;
							exposure.observedState = EXPOSURE_OBSERVED_STATE.DELETING;
							exposure.deletionRequestedAt = generatedAt;
							exposure.systemRequestedUntil = null;
							exposure.targetReference = null;
							exposure.generation += 1;
							exposure.lastError = null;
						}
						await this.exposureQueue.enqueue(
							manager,
							exposure.id,
							exposure.generation
						);
					}

					if (exposures.length > 0) {
						await manager.nativeUpdate(
							CustomDomain,
							{
								exposureId: {
									$in: exposures.map((exposure) => exposure.id),
								},
								state: { $ne: CUSTOM_DOMAIN_STATE.DELETING },
							},
							{
								state: CUSTOM_DOMAIN_STATE.DELETING,
								desiredGeneration: raw('"desiredGeneration" + 1'),
								deletionRequestedAt: generatedAt,
								lastError: null,
								updatedAt: generatedAt,
							}
						);
					}
					if (backends.length === 0) return;
					for (const backend of backends) {
						backend.state = EXPOSURE_BACKEND_STATE.RELEASED;
						backend.drainingAt ??= generatedAt;
						backend.drainDeadline = null;
						backend.releasedAt = generatedAt;
					}
					await manager.flush();
					await this.bindingTargets.reviseOrRelease(
						manager,
						backends.map((backend) => backend.bindingId),
						generatedAt
					);
					await this.versions.bumpEdges(
						manager,
						backends.map((backend) => backend.edgeId),
						generatedAt
					);
					await this.versions.bumpMachines(
						manager,
						backends.map((backend) => backend.machineId),
						generatedAt
					);
				},
				{ propagation: TransactionPropagation.REQUIRED }
			);
		} catch (error) {
			this.logger.error(
				`Failed to invalidate network control snapshots for destroyed sandbox ${event.sandbox.id}`,
				errorStack(error)
			);
		}
	}
}
