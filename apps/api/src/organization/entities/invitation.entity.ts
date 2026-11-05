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
} from '@mikro-orm/decorators/legacy';
import { User } from '../../user/entities/user.entity';
import { Organization } from './organization.entity';

const PENDING_INVITATION_STATUS = 'pending';

@Entity({ tableName: 'invitation' })
@Index({ name: 'invitation_email_index', properties: ['email'] })
@Index({
	name: 'invitation_organizationId_index',
	properties: ['organizationId'],
})
export class Invitation {
	@PrimaryKey({ type: 'uuid', columnType: 'uuid' })
	id: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		foreignKeyName: 'invitation_organizationId_fk',
	})
	organizationId: string;

	@Property({ type: 'string', columnType: 'varchar' })
	email: string;

	@Property({ type: 'string', columnType: 'varchar', nullable: true })
	role: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: PENDING_INVITATION_STATUS,
	})
	status: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'expiresAt',
	})
	expiresAt: Date;

	@ManyToOne({
		entity: () => User,
		mapToPk: true,
		joinColumn: 'inviterId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		foreignKeyName: 'invitation_inviterId_fk',
	})
	inviterId: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
