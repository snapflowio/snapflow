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
	Unique,
} from '@mikro-orm/decorators/legacy';
import { v4 } from 'uuid';
import {
	RealtimeOutboxStatus,
	type RealtimeOutboxStatus as RealtimeOutboxStatusValue,
} from '../constants/realtime-outbox.constants';

const realtimeOutboxStatuses = Object.values(RealtimeOutboxStatus)
	.map((status) => `'${status}'`)
	.join(', ');

@Entity({ tableName: 'realtime_outbox_event' })
@Unique({
	name: 'realtime_outbox_event_deduplication_key_unique',
	properties: ['deduplicationKey'],
})
@Index({
	name: 'realtime_outbox_event_dispatch_index',
	properties: ['status', 'availableAt', 'createdAt'],
})
@Check({
	name: 'CHK_realtime_outbox_event_status',
	expression: `status in (${realtimeOutboxStatuses})`,
})
export class RealtimeOutboxEvent {
	@PrimaryKey({ type: 'uuid', columnType: 'uuid' })
	id: string;

	@Property({ type: 'string', columnType: 'varchar' })
	topic: string;

	@Property({ type: 'uuid', columnType: 'uuid', fieldName: 'aggregateId' })
	aggregateId: string;

	@Property({ type: 'json', columnType: 'jsonb' })
	payload: object;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'deduplicationKey',
	})
	deduplicationKey: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: RealtimeOutboxStatus.PENDING,
	})
	status: RealtimeOutboxStatusValue;

	@Property({ type: 'integer', columnType: 'integer', default: 0 })
	attempts: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'availableAt',
	})
	availableAt: Date;

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
		fieldName: 'publishedAt',
		nullable: true,
	})
	publishedAt: Date | null;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'lastError',
		nullable: true,
	})
	lastError: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
	})
	createdAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
		onUpdate: () => new Date(),
	})
	updatedAt: Date;

	constructor(payload?: object & { topic: string }, aggregateId?: string) {
		if (!payload || !aggregateId) return;

		const now = new Date();
		this.id = v4();
		this.topic = payload.topic;
		this.aggregateId = aggregateId;
		this.payload = payload;
		this.deduplicationKey = this.id;
		this.status = RealtimeOutboxStatus.PENDING;
		this.attempts = 0;
		this.availableAt = now;
		this.lockId = null;
		this.lockedUntil = null;
		this.publishedAt = null;
		this.lastError = null;
		this.createdAt = now;
		this.updatedAt = now;
	}
}
