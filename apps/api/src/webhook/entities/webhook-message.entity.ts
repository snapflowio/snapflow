/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';
import { WebhookEventType } from '../enums/webhook-event-type.enum';
import type { WebhookPayload } from '../types/webhook-payload.types';

const eventTypes = Object.values(WebhookEventType)
	.map((type) => `'${type}'`)
	.join(', ');

@Entity({ tableName: 'webhook_message' })
@Unique({
	name: 'UQ_webhook_message_deduplication_key',
	properties: ['organizationId', 'deduplicationKey'],
})
@Index({
	name: 'UQ_webhook_message_id_organization',
	expression:
		'create unique index "UQ_webhook_message_id_organization" on "webhook_message" ("id", "organizationId")',
})
@Index({
	name: 'IDX_webhook_message_created',
	properties: ['createdAt'],
})
@Check({
	name: 'CHK_webhook_message_event_type',
	expression: `"eventType" in (${eventTypes})`,
})
export class WebhookMessage {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_webhook_message_organization',
	})
	organizationId: string;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'eventType' })
	eventType: WebhookEventType;

	@Property({ type: 'json', columnType: 'jsonb' })
	payload: WebhookPayload;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'deduplicationKey',
	})
	deduplicationKey: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
