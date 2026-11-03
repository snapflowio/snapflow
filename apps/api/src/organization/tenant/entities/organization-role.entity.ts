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
import { Organization } from './organization.entity';

@Entity({ tableName: 'organizationRole' })
@Unique({
	name: 'organizationRole_organizationId_role_unique',
	properties: ['organizationId', 'role'],
})
@Index({ name: 'organizationRole_role_index', properties: ['role'] })
export class OrganizationRole {
	@PrimaryKey({ type: 'uuid', columnType: 'uuid' })
	id: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		foreignKeyName: 'organizationRole_organizationId_fk',
	})
	organizationId: string;

	@Property({ type: 'string', columnType: 'varchar' })
	role: string;

	@Property({ type: 'string', columnType: 'text' })
	permission: string;

	@Property({ type: 'string', columnType: 'varchar', nullable: true })
	description: string | null;

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
		nullable: true,
	})
	updatedAt: Date | null;
}
