/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';

const DEFAULT_CONFIG_ID = 'default';

@Entity({ tableName: 'apikey' })
export class ApiKey {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Index({ name: 'apikey_config_id_index' })
	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'configId',
		default: DEFAULT_CONFIG_ID,
	})
	configId: string;

	@Property({ type: 'string', columnType: 'text', nullable: true })
	name: string | null;

	@Property({ type: 'string', columnType: 'text', nullable: true })
	start: string | null;

	@Index({ name: 'apikey_reference_id_index' })
	@ManyToOne(() => Organization, {
		mapToPk: true,
		joinColumn: 'referenceId',
		foreignKeyName: 'apikey_reference_id_fk',
		deleteRule: 'cascade',
	})
	referenceId: string;

	@Property({ type: 'string', columnType: 'text', nullable: true })
	prefix: string | null;

	@Index({ name: 'apikey_key_index' })
	@Property({ type: 'string', columnType: 'text' })
	key: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'refillInterval',
		nullable: true,
	})
	refillInterval: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'refillAmount',
		nullable: true,
	})
	refillAmount: number | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastRefillAt',
		nullable: true,
	})
	lastRefillAt: Date | null;

	@Property({ type: 'boolean', nullable: true, default: true })
	enabled: boolean | null;

	@Property({
		type: 'boolean',
		fieldName: 'rateLimitEnabled',
		nullable: true,
		default: true,
	})
	rateLimitEnabled: boolean | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'rateLimitTimeWindow',
		nullable: true,
	})
	rateLimitTimeWindow: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'rateLimitMax',
		nullable: true,
	})
	rateLimitMax: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'requestCount',
		nullable: true,
		default: 0,
	})
	requestCount: number | null;

	@Property({ type: 'integer', columnType: 'integer', nullable: true })
	remaining: number | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastRequest',
		nullable: true,
	})
	lastRequest: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'expiresAt',
		nullable: true,
	})
	expiresAt: Date | null;

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

	@Property({ type: 'string', columnType: 'text', nullable: true })
	permissions: string | null;

	@Property({ type: 'string', columnType: 'text', nullable: true })
	metadata: string | null;
}
