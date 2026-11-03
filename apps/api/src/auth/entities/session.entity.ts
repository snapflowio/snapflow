/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Rel } from '@mikro-orm/core';
import {
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { User } from '../../user/entities/user.entity';

@Entity({ tableName: 'session' })
@Unique({ name: 'session_token_unique', properties: ['token'] })
export class Session {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({ type: 'string', columnType: 'varchar' })
	token: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'expiresAt',
	})
	expiresAt: Date;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'ipAddress',
		nullable: true,
	})
	ipAddress: string | null;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'userAgent',
		nullable: true,
	})
	userAgent: string | null;

	@Index({ name: 'session_impersonated_by_index' })
	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'impersonatedBy',
		nullable: true,
	})
	impersonatedBy: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'secondFactorVerifiedAt',
		nullable: true,
	})
	secondFactorVerifiedAt: Date | null;

	@Index({ name: 'session_active_organization_id_index' })
	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'activeOrganizationId',
		nullable: true,
	})
	activeOrganizationId: string | null;

	@Index({ name: 'session_user_id_index' })
	@ManyToOne(() => User, {
		joinColumn: 'userId',
		foreignKeyName: 'session_user_id_fk',
		deleteRule: 'cascade',
	})
	user: Rel<User>;

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
