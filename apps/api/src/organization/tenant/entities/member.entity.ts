/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import {
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { ORGANIZATION_ROLE } from '@snapflow/organization-access';
import { User } from '../../../user/entities/user.entity';
import { Organization } from './organization.entity';

@Entity({ tableName: 'member' })
@Unique({
	name: 'member_organizationId_userId_unique',
	properties: ['organizationId', 'userId'],
})
@Index({ name: 'member_userId_index', properties: ['userId'] })
export class Member {
	[OptionalProps]?: 'createdAt';

	@PrimaryKey({ type: 'uuid', columnType: 'uuid' })
	id: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		foreignKeyName: 'member_organizationId_fk',
	})
	organizationId: string;

	@ManyToOne({
		entity: () => User,
		mapToPk: true,
		joinColumn: 'userId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		foreignKeyName: 'member_userId_fk',
	})
	userId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: ORGANIZATION_ROLE.MEMBER,
	})
	role: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
