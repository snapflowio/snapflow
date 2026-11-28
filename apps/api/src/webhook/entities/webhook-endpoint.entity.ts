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
import { Organization } from '../../organization/entities/organization.entity';
import { WEBHOOK_LIMITS } from '../constants/webhook.constants';
import { WebhookEndpointDisabledReason } from '../enums/webhook-endpoint-disabled-reason.enum';
import type { SubscribableWebhookEventType } from '../enums/webhook-event-type.enum';

const disabledReasons = Object.values(WebhookEndpointDisabledReason)
	.map((reason) => `'${reason}'`)
	.join(', ');

@Entity({ tableName: 'webhook_endpoint' })
@Index({
	name: 'IDX_webhook_endpoint_organization_created',
	properties: ['organizationId', 'createdAt'],
})
@Index({
	name: 'UQ_webhook_endpoint_id_organization',
	expression:
		'create unique index "UQ_webhook_endpoint_id_organization" on "webhook_endpoint" ("id", "organizationId")',
})
@Index({
	name: 'IDX_webhook_endpoint_disabled_notice_pending',
	expression:
		'create index "IDX_webhook_endpoint_disabled_notice_pending" on "webhook_endpoint" ("disabledAt") where "disabledReason" = \'failing\' and "disabledNoticeSentAt" is null',
})
@Check({
	name: 'CHK_webhook_endpoint_disabled_reason',
	expression: `"disabledReason" is null or "disabledReason" in (${disabledReasons})`,
})
@Check({
	name: 'CHK_webhook_endpoint_enabled_state',
	expression:
		'("enabled" and "disabledReason" is null and "disabledAt" is null) or (not "enabled" and "disabledReason" is not null and "disabledAt" is not null)',
})
@Check({
	name: 'CHK_webhook_endpoint_secret_version',
	expression: '"secretVersion" > 0',
})
export class WebhookEndpoint {
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
		foreignKeyName: 'FK_webhook_endpoint_organization',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: `varchar(${WEBHOOK_LIMITS.URL_MAX_LENGTH})`,
	})
	url: string;

	@Property({
		type: 'string',
		columnType: `varchar(${WEBHOOK_LIMITS.DESCRIPTION_MAX_LENGTH})`,
		nullable: true,
	})
	description: string | null;

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		fieldName: 'eventTypes',
	})
	eventTypes: SubscribableWebhookEventType[];

	@Property({ type: 'boolean', columnType: 'boolean', default: true })
	enabled: boolean;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'disabledReason',
		nullable: true,
	})
	disabledReason: WebhookEndpointDisabledReason | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'disabledAt',
		nullable: true,
	})
	disabledAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'disabledNoticeSentAt',
		nullable: true,
	})
	disabledNoticeSentAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'failingSince',
		nullable: true,
	})
	failingSince: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastSucceededAt',
		nullable: true,
	})
	lastSucceededAt: Date | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'secretVersion',
	})
	secretVersion: number;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'encryptedSecret',
		lazy: true,
		hidden: true,
	})
	encryptedSecret: string;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'previousEncryptedSecret',
		nullable: true,
		lazy: true,
		hidden: true,
	})
	previousEncryptedSecret: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'previousSecretExpiresAt',
		nullable: true,
	})
	previousSecretExpiresAt: Date | null;

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
