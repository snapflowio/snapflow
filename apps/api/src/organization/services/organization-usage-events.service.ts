/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { SandboxEvents } from '../../sandbox/constants/sandbox-events.constants';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxCreatedEvent } from '../../sandbox/events/sandbox-create.event';
import { SandboxStateUpdatedEvent } from '../../sandbox/events/sandbox-state-updated.event';
import { SnapshotEvents } from '../../snapshot/constants/snapshot-events.constants';
import { SnapshotCreatedEvent } from '../../snapshot/events/snapshot-created.event';
import { SnapshotStateUpdatedEvent } from '../../snapshot/events/snapshot-state-updated.event';
import { VolumeEvents } from '../../volume/constants/volume-events.constants';
import { VolumeCreatedEvent } from '../../volume/events/volume-created.event';
import { VolumeStateUpdatedEvent } from '../../volume/events/volume-state-updated.event';
import { ORGANIZATION_USAGE_CACHE } from '../constants/organization-usage-cache.constants';
import {
	SANDBOX_STATES_CONDITIONALLY_CONSUMING_COMPUTE,
	SANDBOX_STATES_CONSUMING_COMPUTE,
} from '../constants/sandbox-states-consuming-compute.constants';
import { SANDBOX_STATES_CONSUMING_DISK } from '../constants/sandbox-states-consuming-disk.constants';
import { SNAPSHOT_STATES_CONSUMING_RESOURCES } from '../constants/snapshot-states-consuming-resources.constants';
import { VOLUME_STATES_CONSUMING_RESOURCES } from '../constants/volume-states-consuming-resources.constants';
import {
	SANDBOX_QUOTA_RESOURCES,
	type SandboxResourceAmounts,
	type SandboxUsageScope,
} from '../utils/organization-usage.util';
import { calculateQuotaUsageDelta } from '../utils/organization-usage-cache.util';
import { OrganizationUsageCacheService } from './organization-usage-cache.service';

@Injectable()
export class OrganizationUsageEventsService {
	private readonly logger = new Logger(OrganizationUsageEventsService.name);

	constructor(
		private readonly redisLockProvider: RedisLockProvider,
		private readonly usageCache: OrganizationUsageCacheService
	) {}

	@OnEvent(SandboxEvents.CREATED)
	async handleSandboxCreated(event: SandboxCreatedEvent) {
		await this.updateSandboxUsage(event.sandbox, {
			cpu: event.sandbox.cpu,
			memory: event.sandbox.mem,
			disk: event.sandbox.disk,
			gpu: event.sandbox.gpu,
		});
	}

	@OnEvent(SandboxEvents.STATE_UPDATED)
	async handleSandboxStateUpdated(event: SandboxStateUpdatedEvent) {
		if (
			SANDBOX_STATES_CONDITIONALLY_CONSUMING_COMPUTE.includes(event.oldState) ||
			SANDBOX_STATES_CONDITIONALLY_CONSUMING_COMPUTE.includes(event.newState)
		) {
			return;
		}

		const { sandbox, oldState, newState } = event;
		const computeDelta = (amount: number) =>
			calculateQuotaUsageDelta(
				amount,
				oldState,
				newState,
				SANDBOX_STATES_CONSUMING_COMPUTE
			);
		await this.updateSandboxUsage(
			sandbox,
			{
				cpu: computeDelta(sandbox.cpu),
				memory: computeDelta(sandbox.mem),
				disk: calculateQuotaUsageDelta(
					sandbox.disk,
					oldState,
					newState,
					SANDBOX_STATES_CONSUMING_DISK
				),
				gpu: computeDelta(sandbox.gpu),
			},
			true
		);
	}

	@OnEvent(SnapshotEvents.CREATED)
	async handleSnapshotCreated(event: SnapshotCreatedEvent) {
		const { organizationId, id } = event.snapshot;
		if (!organizationId) return;
		await this.withQuotaUsageLock(
			`snapshot:${id}:quota-usage-update`,
			`Error updating cached snapshot quota usage for organization ${organizationId}`,
			() =>
				this.usageCache.updateCurrentCountUsage(
					organizationId,
					'snapshot_count',
					1
				)
		);
	}

	@OnEvent(SnapshotEvents.STATE_UPDATED)
	async handleSnapshotStateUpdated(event: SnapshotStateUpdatedEvent) {
		const { organizationId, id } = event.snapshot;
		if (!organizationId) return;
		await this.withQuotaUsageLock(
			`snapshot:${id}:quota-usage-update`,
			`Error updating cached snapshot quota usage for organization ${organizationId}`,
			async () => {
				const countDelta = calculateQuotaUsageDelta(
					1,
					event.oldState,
					event.newState,
					SNAPSHOT_STATES_CONSUMING_RESOURCES
				);
				if (countDelta !== 0) {
					await this.usageCache.updateCurrentCountUsage(
						organizationId,
						'snapshot_count',
						countDelta
					);
				}
			}
		);
	}

	@OnEvent(VolumeEvents.CREATED)
	async handleVolumeCreated(event: VolumeCreatedEvent) {
		const { organizationId, id } = event.volume;
		if (!organizationId) return;
		await this.withQuotaUsageLock(
			`volume:${id}:quota-usage-update`,
			`Error updating cached volume quota usage for organization ${organizationId}`,
			() =>
				this.usageCache.updateCurrentCountUsage(
					organizationId,
					'volume_count',
					1
				)
		);
	}

	@OnEvent(VolumeEvents.STATE_UPDATED)
	async handleVolumeStateUpdated(event: VolumeStateUpdatedEvent) {
		const { organizationId, id } = event.volume;
		if (!organizationId) return;
		await this.withQuotaUsageLock(
			`volume:${id}:quota-usage-update`,
			`Error updating cached volume quota usage for organization ${organizationId}`,
			async () => {
				const countDelta = calculateQuotaUsageDelta(
					1,
					event.oldState,
					event.newState,
					VOLUME_STATES_CONSUMING_RESOURCES
				);
				if (countDelta !== 0) {
					await this.usageCache.updateCurrentCountUsage(
						organizationId,
						'volume_count',
						countDelta
					);
				}
			}
		);
	}

	private async updateSandboxUsage(
		sandbox: Pick<Sandbox, 'id' | 'organizationId' | 'sandboxClass'>,
		deltas: SandboxResourceAmounts,
		skipZeroDeltas = false
	): Promise<void> {
		const scope: SandboxUsageScope = {
			organizationId: sandbox.organizationId,
			sandboxClass: sandbox.sandboxClass,
		};
		await this.withQuotaUsageLock(
			`sandbox:${sandbox.id}:quota-usage-update`,
			`Error updating cached sandbox quota usage for organization ${sandbox.organizationId} class ${sandbox.sandboxClass}`,
			async () => {
				for (const resource of SANDBOX_QUOTA_RESOURCES) {
					if (skipZeroDeltas && deltas[resource] === 0) continue;
					await this.usageCache.updateCurrentSandboxUsage(
						scope,
						resource,
						deltas[resource]
					);
				}
			}
		);
	}

	private async withQuotaUsageLock(
		lockKey: string,
		failureMessage: string,
		update: () => Promise<void>
	): Promise<void> {
		const lease = await this.redisLockProvider.acquire(
			lockKey,
			ORGANIZATION_USAGE_CACHE.LOCK_TTL_SECONDS
		);
		try {
			await update();
		} catch (error) {
			this.logger.warn(failureMessage, error);
		} finally {
			await lease.release();
		}
	}
}
