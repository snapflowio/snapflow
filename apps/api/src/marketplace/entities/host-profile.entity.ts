/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';
import {
	createdAtColumn,
	updatedAtColumn,
} from '../../settlement/utils/settlement-columns.util';
import { HOST_PROFILE_LIMITS } from '../constants/host-profile.constants';

@Entity({ tableName: 'host_profile' })
export class HostProfile {
	[OptionalProps]?: 'createdAt' | 'updatedAt';

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		primary: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_host_profile_organization',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: `varchar(${HOST_PROFILE_LIMITS.DISPLAY_NAME_MAX_LENGTH})`,
		fieldName: 'displayName',
	})
	displayName: string;

	@Property({
		type: 'string',
		columnType: `varchar(${HOST_PROFILE_LIMITS.DESCRIPTION_MAX_LENGTH})`,
		fieldName: 'description',
		nullable: true,
	})
	description: string | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'hostTermsVersion',
		nullable: true,
	})
	hostTermsVersion: string | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'hostTermsAcceptedAt',
		nullable: true,
	})
	hostTermsAcceptedAt: Date | null = null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'hostTermsAcceptedBy',
		nullable: true,
	})
	hostTermsAcceptedBy: string | null = null;

	@Property(createdAtColumn)
	createdAt: Date;

	@Property(updatedAtColumn)
	updatedAt: Date;
}
