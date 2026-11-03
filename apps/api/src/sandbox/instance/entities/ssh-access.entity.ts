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
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { Sandbox } from './sandbox.entity';

@Entity({ tableName: 'ssh_access' })
export class SshAccess {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'ssh_access_sandboxId_fk',
	})
	sandboxId: string;

	@Property({
		type: 'string',
		columnType: 'text',
	})
	token: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamp(3)',
		fieldName: 'expiresAt',
	})
	expiresAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamp(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamp(3)',
		fieldName: 'updatedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}
