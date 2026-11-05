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
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { StripeEventScope } from '../enums/stripe-event-scope.enum';

@Entity({ tableName: 'stripe_event' })
@Index({
	name: 'IDX_stripe_event_pending',
	properties: ['nextAttemptAt'],
	where: '"processedAt" is null and "deadLetteredAt" is null',
})
@Check({
	name: 'CHK_stripe_event_scope',
	expression: `"scope" in (${sqlValueList(StripeEventScope)})`,
})
@Check({
	name: 'CHK_stripe_event_attempts',
	expression: '"attempts" >= 0',
})
export class StripeEvent {
	@PrimaryKey({ type: 'string', columnType: 'varchar' })
	id: string;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'scope' })
	scope: StripeEventScope;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'type' })
	type: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'relatedObjectId',
		nullable: true,
	})
	relatedObjectId: string | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'context',
		nullable: true,
	})
	context: string | null = null;

	@Property({ type: 'boolean', fieldName: 'livemode' })
	livemode: boolean;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'receivedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	receivedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'processedAt',
		nullable: true,
	})
	processedAt: Date | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'deadLetteredAt',
		nullable: true,
	})
	deadLetteredAt: Date | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'attempts',
		default: 0,
	})
	attempts = 0;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'nextAttemptAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	nextAttemptAt: Date;

	@Property({
		type: 'text',
		columnType: 'text',
		fieldName: 'lastError',
		nullable: true,
	})
	lastError: string | null = null;
}
