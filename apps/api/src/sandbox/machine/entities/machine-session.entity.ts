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
import { SHA256_HEX_LENGTH } from '../../../common/constants/digest.constants';
import { Machine } from './machine.entity';

@Entity({ tableName: 'machine_session' })
@Index({
	name: 'IDX_machine_session_machine_generation',
	expression:
		'create unique index "IDX_machine_session_machine_generation" on "machine_session" ("machineId", "generation")',
})
@Index({
	name: 'IDX_machine_session_expiry',
	properties: ['expiresAt'],
})
@Index({
	name: 'IDX_machine_session_token_hash',
	expression:
		'create unique index "IDX_machine_session_token_hash" on "machine_session" ("tokenHash")',
})
@Check({
	name: 'CHK_machine_session_generation',
	expression: '"generation" > 0',
})
export class MachineSession {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_session_machine',
	})
	machineId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
	})
	generation: number;

	@Property({
		type: 'string',
		columnType: `varchar(${SHA256_HEX_LENGTH})`,
		fieldName: 'tokenHash',
	})
	tokenHash: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'expiresAt',
	})
	expiresAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'revokedAt',
		nullable: true,
	})
	revokedAt: Date | null;

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
