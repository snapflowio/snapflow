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
import { WebhookAttemptTrigger } from '../enums/webhook-attempt-trigger.enum';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { WebhookEndpoint } from './webhook-endpoint.entity';
import { WebhookMessage } from './webhook-message.entity';

const deliveryStatuses = Object.values(WebhookDeliveryStatus)
	.map((status) => `'${status}'`)
	.join(', ');
const attemptTriggers = Object.values(WebhookAttemptTrigger)
	.map((trigger) => `'${trigger}'`)
	.join(', ');

@Entity({ tableName: 'webhook_delivery' })
@Unique({
	name: 'UQ_webhook_delivery_endpoint_message',
	properties: ['endpointId', 'messageId'],
})
@Index({
	name: 'IDX_webhook_delivery_dispatch',
	expression:
		'create index "IDX_webhook_delivery_dispatch" on "webhook_delivery" ("nextAttemptAt") where "status" = \'pending\'',
})
@Index({
	name: 'IDX_webhook_delivery_message',
	properties: ['messageId'],
})
@Index({
	name: 'IDX_webhook_delivery_endpoint_created',
	properties: ['endpointId', 'createdAt'],
})
@Check({
	name: 'CHK_webhook_delivery_status',
	expression: `"status" in (${deliveryStatuses})`,
})
@Check({
	name: 'CHK_webhook_delivery_next_trigger',
	expression: `"nextTrigger" in (${attemptTriggers})`,
})
@Check({
	name: 'CHK_webhook_delivery_attempts',
	expression: '"attempts" >= 0',
})
export class WebhookDelivery {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({ type: 'uuid', columnType: 'uuid', fieldName: 'organizationId' })
	organizationId: string;

	@ManyToOne({
		entity: () => WebhookEndpoint,
		mapToPk: true,
		joinColumns: ['endpointId', 'organizationId'],
		referencedColumnNames: ['id', 'organizationId'],
		ownColumns: ['endpointId'],
		columnTypes: ['uuid', 'uuid'],
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_webhook_delivery_endpoint',
	})
	endpointId: string;

	@ManyToOne({
		entity: () => WebhookMessage,
		mapToPk: true,
		joinColumns: ['messageId', 'organizationId'],
		referencedColumnNames: ['id', 'organizationId'],
		ownColumns: ['messageId'],
		columnTypes: ['uuid', 'uuid'],
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_webhook_delivery_message',
	})
	messageId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: WebhookDeliveryStatus.PENDING,
	})
	status: WebhookDeliveryStatus;

	@Property({ type: 'integer', columnType: 'integer', default: 0 })
	attempts: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'nextTrigger',
		default: WebhookAttemptTrigger.SCHEDULED,
	})
	nextTrigger: WebhookAttemptTrigger;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'nextAttemptAt',
		nullable: true,
	})
	nextAttemptAt: Date | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'lockId',
		nullable: true,
	})
	lockId: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lockedUntil',
		nullable: true,
	})
	lockedUntil: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastAttemptAt',
		nullable: true,
	})
	lastAttemptAt: Date | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'lastResponseStatus',
		nullable: true,
	})
	lastResponseStatus: number | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}
