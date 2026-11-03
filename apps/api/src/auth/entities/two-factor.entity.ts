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

@Entity({ tableName: 'twoFactor' })
@Index({
	name: 'two_factor_user_id_index',
	expression:
		'create unique index "two_factor_user_id_index" on "twoFactor" ("userId")',
})
export class TwoFactor {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Index({ name: 'two_factor_secret_index' })
	@Property({ type: 'string', columnType: 'text' })
	secret: string;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'backupCodes',
	})
	backupCodes: string;

	@Property({
		type: 'boolean',
		default: true,
	})
	verified: boolean;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'failedVerificationCount',
		default: 0,
	})
	failedVerificationCount: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lockedUntil',
		nullable: true,
	})
	lockedUntil: Date | null;

	@ManyToOne(() => User, {
		joinColumn: 'userId',
		foreignKeyName: 'two_factor_user_id_fk',
		deleteRule: 'cascade',
	})
	user: Rel<User>;
}
