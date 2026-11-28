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
} from '@mikro-orm/decorators/legacy';
import { User } from '../../user/entities/user.entity';

@Entity({ tableName: 'account' })
export class Account {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'accountId',
	})
	accountId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'providerId',
	})
	providerId: string;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'accessToken',
		nullable: true,
	})
	accessToken: string | null;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'refreshToken',
		nullable: true,
	})
	refreshToken: string | null;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'idToken',
		nullable: true,
	})
	idToken: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'accessTokenExpiresAt',
		nullable: true,
	})
	accessTokenExpiresAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'refreshTokenExpiresAt',
		nullable: true,
	})
	refreshTokenExpiresAt: Date | null;

	@Property({
		type: 'string',
		columnType: 'text',
		nullable: true,
	})
	scope: string | null;

	@Property({
		type: 'string',
		columnType: 'text',
		nullable: true,
	})
	password: string | null;

	@Index({ name: 'account_user_id_index' })
	@ManyToOne(() => User, {
		joinColumn: 'userId',
		foreignKeyName: 'account_user_id_fk',
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
