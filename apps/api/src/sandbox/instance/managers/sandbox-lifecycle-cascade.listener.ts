/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IsolatedEntityManagerContext } from '../../../common/decorators/isolated-entity-manager-context.decorator';
import { errorMessage } from '../../../common/utils/error/error.util';
import { OrganizationEvents } from '../../../organization/tenant/constants/organization-events.constants';
import { OrganizationSuspendedSandboxStoppedEvent } from '../../../organization/tenant/events/organization-suspended-sandbox-stopped.event';
import { SANDBOX_WORKER_LIMITS } from '../constants/sandbox.constants';
import { SandboxEvents } from '../constants/sandbox-events.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxDestroyedEvent } from '../events/sandbox-destroyed.event';
import { SandboxLifecycleService } from '../services/lifecycle/sandbox-lifecycle.service';

@Injectable()
export class SandboxLifecycleCascadeListener {
	private readonly logger = new Logger(SandboxLifecycleCascadeListener.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly lifecycle: SandboxLifecycleService
	) {}

	@OnEvent(OrganizationEvents.SUSPENDED_SANDBOX_STOPPED)
	@IsolatedEntityManagerContext()
	async handleSuspendedOrganizationSandboxStopped(
		event: OrganizationSuspendedSandboxStoppedEvent
	): Promise<void> {
		const sandbox = await this.entityManager.findOne(Sandbox, {
			id: event.sandboxId,
		});
		if (!sandbox) {
			this.logger.warn(
				`Suspended organization sandbox ${event.sandboxId} no longer exists`
			);
			return;
		}
		await this.lifecycle
			.stop(event.sandboxId, sandbox.organizationId)
			.catch((error) => {
				this.logger.error(
					`Error stopping sandbox of suspended organization. SandboxId: ${event.sandboxId}: `,
					error
				);
			});
	}

	@OnEvent(SandboxEvents.DESTROYED)
	@IsolatedEntityManagerContext()
	async handleSandboxDestroyedCascadeLinked(
		event: SandboxDestroyedEvent
	): Promise<void> {
		if (!event.sandbox?.id) {
			return;
		}

		const ownerId = event.sandbox.id;
		let afterId: string | undefined;
		do {
			const followers = await this.findFollowers(ownerId, afterId);
			for (const follower of followers) {
				await this.destroyFollower(follower, ownerId);
			}
			afterId = followers.at(-1)?.id;
			if (followers.length < SANDBOX_WORKER_LIMITS.linkedFollowerBatchSize) {
				break;
			}
		} while (afterId);
	}

	private findFollowers(
		ownerId: string,
		afterId: string | undefined
	): Promise<Sandbox[]> {
		return this.entityManager.find(
			Sandbox,
			{
				linkedSandboxId: ownerId,
				desiredState: { $ne: SandboxDesiredState.DESTROYED },
				...(afterId ? { id: { $gt: afterId } } : {}),
			},
			{
				orderBy: { id: QueryOrder.ASC },
				limit: SANDBOX_WORKER_LIMITS.linkedFollowerBatchSize,
			}
		);
	}

	private async destroyFollower(
		follower: Sandbox,
		ownerId: string
	): Promise<void> {
		try {
			await this.lifecycle.destroy(follower.id, follower.organizationId);
		} catch (error) {
			this.logger.warn(
				`Failed to cascade-destroy linked follower ${follower.id} after owner ${ownerId} was destroyed: ${errorMessage(error)}`
			);
		}
	}
}
