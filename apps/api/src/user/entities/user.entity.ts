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
	Enum,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { JsonTextType } from '../../common/types/json-text.types';
import { SystemRole } from '../enums/system-role.enum';

export interface UserSSHKeyPair {
	privateKey: string;
	publicKey: string;
}

export interface UserPublicKey {
	key: string;
	name: string;
}

@Entity({ tableName: 'user' })
@Unique({ name: 'user_email_unique', properties: ['email'] })
export class User {
	@PrimaryKey({ type: 'uuid', columnType: 'uuid' })
	id: string;

	@Property({ type: 'string', columnType: 'varchar' })
	name: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: '',
	})
	email: string;

	@Property({
		type: 'boolean',
		fieldName: 'emailVerified',
		default: false,
	})
	emailVerified: boolean;

	@Property({
		type: JsonTextType,
		fieldName: 'keyPair',
		nullable: true,
	})
	keyPair: UserSSHKeyPair | null;

	@Property({
		type: JsonTextType,
		fieldName: 'publicKeys',
		defaultRaw: "'[]'",
	})
	publicKeys: UserPublicKey[];

	@Property({
		type: 'boolean',
		fieldName: 'twoFactorEnabled',
		default: false,
	})
	twoFactorEnabled: boolean;

	@Property({
		type: 'string',
		columnType: 'text',
		nullable: true,
	})
	image: string | null;

	@Enum({
		items: () => SystemRole,
		nativeEnumName: 'user_role_enum',
		default: SystemRole.USER,
	})
	role: SystemRole;

	@Property({
		type: 'boolean',
		default: false,
	})
	banned: boolean;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'banReason',
		nullable: true,
	})
	banReason: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'banExpires',
		nullable: true,
	})
	banExpires: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'bannedAt',
		nullable: true,
	})
	bannedAt: Date | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'lastActiveOrganizationId',
		nullable: true,
	})
	lastActiveOrganizationId: string | null;

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
