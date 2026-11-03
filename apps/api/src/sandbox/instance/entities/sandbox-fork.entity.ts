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
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Sandbox } from './sandbox.entity';

@Entity({ tableName: 'sandbox_fork' })
@Unique({
	name: 'sandbox_fork_childId_unique',
	properties: ['childId'],
})
@Index({
	name: 'IDX_sandbox_fork_parent',
	properties: ['parentId', 'createdAt', 'id'],
})
export class SandboxFork {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'parentId',
		columnType: 'varchar',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'sandbox_fork_parentId_fk',
	})
	parentId: string;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'childId',
		columnType: 'varchar',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'sandbox_fork_childId_fk',
	})
	childId: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
