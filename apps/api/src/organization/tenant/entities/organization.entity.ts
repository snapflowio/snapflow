/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import {
	Entity,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { DEFAULT_SUSPENSION_CLEANUP_GRACE_PERIOD_HOURS } from '@snapflow/organization-access';
import { User } from '../../../user/entities/user.entity';

@Entity({ tableName: 'organization' })
@Unique({ name: 'organization_slug_unique', properties: ['slug'] })
@Unique({
	name: 'UQ_organization_personal_owner',
	properties: ['createdBy'],
	where: '"personal" = true and "deletedAt" is null',
})
export class Organization {
	[OptionalProps]?:
		| 'personal'
		| 'telemetryEnabled'
		| 'suspended'
		| 'suspensionCleanupGracePeriodHours'
		| 'createdAt'
		| 'updatedAt';

	@PrimaryKey({ type: 'uuid', columnType: 'uuid' })
	id: string;

	@Property({ type: 'string', columnType: 'varchar' })
	name: string;

	@Property({ type: 'string', columnType: 'varchar' })
	slug: string;

	@Property({ type: 'string', columnType: 'text', nullable: true })
	logo: string | null;

	@Property({ type: 'string', columnType: 'text', nullable: true })
	metadata: string | null;

	@Property({ type: 'boolean', default: false })
	personal: boolean;

	@ManyToOne({
		entity: () => User,
		mapToPk: true,
		joinColumn: 'createdBy',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		foreignKeyName: 'organization_createdBy_fk',
	})
	createdBy: string | null;

	@Property({ type: 'boolean', fieldName: 'telemetryEnabled', default: true })
	telemetryEnabled: boolean;

	@Property({ type: 'boolean', default: false })
	suspended: boolean;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'suspendedAt',
		nullable: true,
	})
	suspendedAt: Date | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'suspensionReason',
		nullable: true,
	})
	suspensionReason: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'suspendedUntil',
		nullable: true,
	})
	suspendedUntil: Date | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'suspensionCleanupGracePeriodHours',
		default: DEFAULT_SUSPENSION_CLEANUP_GRACE_PERIOD_HOURS,
	})
	suspensionCleanupGracePeriodHours: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'deletedAt',
		nullable: true,
	})
	deletedAt: Date | null;

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
