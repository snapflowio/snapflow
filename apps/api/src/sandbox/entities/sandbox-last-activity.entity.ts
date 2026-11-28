/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PrimaryKeyProp, type Rel } from '@mikro-orm/core';
import {
	Entity,
	Index,
	OneToOne,
	Property,
} from '@mikro-orm/decorators/legacy';
import { Sandbox } from './sandbox.entity';

@Entity({ tableName: 'sandbox_last_activity' })
@Index({
	name: 'IDX_sandbox_last_activity_time',
	properties: ['lastActivityAt', 'sandbox'],
})
export class SandboxLastActivity {
	@OneToOne({
		entity: () => Sandbox,
		inversedBy: 'lastActivityAt',
		primary: true,
		owner: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'sandbox_last_activity_sandboxId_fk',
	})
	sandbox: Rel<Sandbox>;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastActivityAt',
	})
	lastActivityAt: Date;

	[PrimaryKeyProp]?: 'sandbox';

	get sandboxId(): string {
		return this.sandbox.id;
	}
}
