/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IsolatedEntityManagerContext } from '../../../common/decorators/isolated-entity-manager-context.decorator';
import { errorMessage } from '../../../common/utils/error/error.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import { SandboxCreatedEvent } from '../../events/sandbox-create.event';
import { Volume } from '../entities/volume.entity';

const VOLUME_LAST_USED_LOCK_SECONDS = 60;

@Injectable()
export class VolumeLastUsedListener {
	private readonly logger = new Logger(VolumeLastUsedListener.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly redisLockProvider: RedisLockProvider
	) {}

	@OnEvent(SandboxEvents.CREATED)
	@IsolatedEntityManagerContext()
	private async handleSandboxCreatedEvent(event: SandboxCreatedEvent) {
		if (!event.sandbox.volumes.length) {
			return;
		}

		try {
			const volumeIds = event.sandbox.volumes.map((vol) => vol.volumeId);
			const volumes = await this.entityManager.find(Volume, {
				id: { $in: volumeIds },
			});
			const lastUsedAt = event.sandbox.createdAt;

			for (const volume of volumes) {
				try {
					if (
						!(await this.redisLockProvider.claim(
							`volume:${volume.id}:update-last-used`,
							VOLUME_LAST_USED_LOCK_SECONDS
						))
					) {
						continue;
					}
					volume.lastUsedAt = lastUsedAt;
				} catch (error) {
					this.logger.error(
						`Failed to update volume lastUsedAt timestamp for sandbox ${event.sandbox.id}: ${errorMessage(error)}`
					);
				}
			}

			await this.entityManager.flush();
		} catch (err) {
			this.logger.error(err);
		}
	}
}
