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

@Entity({ tableName: 'passkey' })
@Index({
	name: 'passkey_credential_id_index',
	expression:
		'create unique index "passkey_credential_id_index" on "passkey" ("credentialID")',
})
export class Passkey {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: 'text',
		nullable: true,
	})
	name: string | null;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'publicKey',
	})
	publicKey: string;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'credentialID',
	})
	credentialID: string;

	@Property({ type: 'integer', columnType: 'integer' })
	counter: number;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'deviceType',
	})
	deviceType: string;

	@Property({
		type: 'boolean',
		fieldName: 'backedUp',
	})
	backedUp: boolean;

	@Property({
		type: 'string',
		columnType: 'text',
		nullable: true,
	})
	transports: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	@Property({
		type: 'string',
		columnType: 'text',
		nullable: true,
	})
	aaguid: string | null;

	@Index({ name: 'passkey_user_id_index' })
	@ManyToOne(() => User, {
		joinColumn: 'userId',
		foreignKeyName: 'passkey_user_id_fk',
		deleteRule: 'cascade',
	})
	user: Rel<User>;
}
