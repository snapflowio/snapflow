/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { WebhookAttemptTrigger } from '../enums/webhook-attempt-trigger.enum';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import type {
	WebhookPayload,
	WebhookPublication,
} from '../types/webhook-payload.types';

const PUBLISH_SQL = `
	WITH message AS (
		INSERT INTO webhook_message (id, "organizationId", "eventType", payload, "deduplicationKey", "createdAt")
		SELECT gen_random_uuid(), ?, ?, ?::jsonb, ?, transaction_timestamp()
		WHERE EXISTS (
			SELECT 1
			FROM webhook_endpoint subscribed
			WHERE subscribed."organizationId" = ?
			  AND subscribed.enabled
			  AND ?::text = ANY(subscribed."eventTypes")
		)
		ON CONFLICT ("organizationId", "deduplicationKey") DO NOTHING
		RETURNING id, "organizationId", "eventType"
	)
	INSERT INTO webhook_delivery (id, "organizationId", "endpointId", "messageId", status, attempts, "nextTrigger", "nextAttemptAt", "createdAt", "updatedAt")
	SELECT gen_random_uuid(), message."organizationId", endpoint.id, message.id, ?, 0, ?, transaction_timestamp(), transaction_timestamp(), transaction_timestamp()
	FROM message
	JOIN webhook_endpoint endpoint ON endpoint."organizationId" = message."organizationId"
	WHERE endpoint.enabled
	  AND message."eventType" = ANY(endpoint."eventTypes")`;

export async function webhookPayload(
	manager: EntityManager,
	publication: Pick<WebhookPublication, 'type' | 'data'>
): Promise<WebhookPayload> {
	return {
		type: publication.type,
		timestamp: (await databaseNow(manager)).toISOString(),
		data: publication.data,
	};
}

export async function publishWebhook(
	manager: EntityManager,
	publication: WebhookPublication
): Promise<void> {
	const payload = await webhookPayload(manager, publication);
	await manager.execute(PUBLISH_SQL, [
		publication.organizationId,
		publication.type,
		JSON.stringify(payload),
		publication.deduplicationKey,
		publication.organizationId,
		publication.type,
		WebhookDeliveryStatus.PENDING,
		WebhookAttemptTrigger.SCHEDULED,
	]);
}
