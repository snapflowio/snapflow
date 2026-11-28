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
import { addDays } from '../../common/utils/time.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { WEBHOOK_RETENTION } from '../constants/webhook.constants';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';

const PRUNE_SQL = `
	DELETE FROM webhook_message
	WHERE id IN (
		SELECT message.id
		FROM webhook_message message
		WHERE message."createdAt" < ?
		  AND NOT EXISTS (
			SELECT 1
			FROM webhook_delivery delivery
			WHERE delivery."messageId" = message.id
			  AND delivery.status = ?
		  )
		ORDER BY message."createdAt" ASC
		LIMIT ?
	)
	RETURNING id`;

@Injectable()
export class WebhookRetentionService {
	private readonly logger = new Logger(WebhookRetentionService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService
	) {}

	async prune(): Promise<void> {
		const manager = this.entityManager.fork();
		const cutoff = addDays(
			await databaseNow(manager),
			-this.config.get('webhooks.retentionDays')
		);
		let deleted = 0;
		let batch: number;
		do {
			const removed = await manager.execute<{ id: string }[]>(PRUNE_SQL, [
				cutoff,
				WebhookDeliveryStatus.PENDING,
				WEBHOOK_RETENTION.batchSize,
			]);
			batch = removed.length;
			deleted += batch;
		} while (batch === WEBHOOK_RETENTION.batchSize);
		if (deleted > 0) {
			this.logger.log(`Pruned ${deleted} expired webhook messages`);
		}
	}
}
