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
} from '@mikro-orm/decorators/legacy';
import { WebhookAttemptTrigger } from '../enums/webhook-attempt-trigger.enum';
import { WebhookDelivery } from './webhook-delivery.entity';

const attemptTriggers = Object.values(WebhookAttemptTrigger)
	.map((trigger) => `'${trigger}'`)
	.join(', ');

@Entity({ tableName: 'webhook_delivery_attempt' })
@Index({
	name: 'IDX_webhook_delivery_attempt_delivery_created',
	properties: ['deliveryId', 'createdAt'],
})
@Check({
	name: 'CHK_webhook_delivery_attempt_trigger',
	expression: `"trigger" in (${attemptTriggers})`,
})
@Check({
	name: 'CHK_webhook_delivery_attempt_duration',
	expression: '"durationMilliseconds" >= 0',
})
export class WebhookDeliveryAttempt {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({ type: 'uuid', columnType: 'uuid', fieldName: 'organizationId' })
	organizationId: string;

	@ManyToOne({
		entity: () => WebhookDelivery,
		mapToPk: true,
		joinColumn: 'deliveryId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_webhook_delivery_attempt_delivery',
	})
	deliveryId: string;

	@Property({ type: 'string', columnType: 'varchar' })
	trigger: WebhookAttemptTrigger;

	@Property({ type: 'boolean', columnType: 'boolean' })
	succeeded: boolean;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'responseStatus',
		nullable: true,
	})
	responseStatus: number | null;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'responseBody',
		nullable: true,
	})
	responseBody: string | null;

	@Property({ type: 'string', columnType: 'text', nullable: true })
	error: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'durationMilliseconds',
	})
	durationMilliseconds: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
