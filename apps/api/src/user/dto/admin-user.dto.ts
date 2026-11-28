/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { EnumArrayQuery } from '../../common/decorators/enum-array-query.decorator';
import { SearchQuery } from '../../common/decorators/search-query.decorator';
import {
	SortDirectionQuery,
	SortFieldQuery,
} from '../../common/decorators/sort-query.decorator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import { SortDirection } from '../../common/enums/sort-direction.enum';
import type { User } from '../entities/user.entity';
import { AdminUserSortField } from '../enums/admin-user-sort-field.enum';
import { AdminUserStatus } from '../enums/admin-user-status.enum';
import { SystemRole } from '../enums/system-role.enum';

const DEFAULT_SORT_FIELD = AdminUserSortField.CREATED_AT;
const DEFAULT_SORT_DIRECTION = SortDirection.DESC;

@ApiSchema({ name: 'AdminUserListQuery' })
export class AdminUserListQueryDto extends CursorPageQueryDto {
	@SearchQuery('Name or email fragment')
	query?: string;

	@EnumArrayQuery({
		enum: SystemRole,
		enumName: 'SystemRole',
		description: 'Roles to include',
	})
	roles?: SystemRole[];

	@EnumArrayQuery({
		enum: AdminUserStatus,
		enumName: 'AdminUserStatus',
		description: 'Account statuses to include',
	})
	statuses?: AdminUserStatus[];

	@SortFieldQuery({
		enum: AdminUserSortField,
		enumName: 'AdminUserSortField',
		default: DEFAULT_SORT_FIELD,
	})
	sort = DEFAULT_SORT_FIELD;

	@SortDirectionQuery(DEFAULT_SORT_DIRECTION)
	order = DEFAULT_SORT_DIRECTION;
}

@ApiSchema({ name: 'AdminUser' })
export class AdminUserDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	email: string;

	@ApiProperty({ enum: SystemRole, enumName: 'SystemRole' })
	role: SystemRole;

	@ApiProperty()
	emailVerified: boolean;

	@ApiProperty({ description: 'Verified TOTP two-factor authentication' })
	twoFactorEnabled: boolean;

	@ApiProperty({ description: 'At least one registered passkey' })
	passkeyRegistered: boolean;

	@ApiProperty({
		description:
			'Can read restricted abuse evidence, such as material from CSAM reports',
	})
	restrictedEvidenceAccess: boolean;

	@ApiProperty()
	banned: boolean;

	@ApiProperty({ type: String, nullable: true })
	banReason: string | null;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	banExpires: string | null;

	@ApiProperty({ format: 'date-time' })
	createdAt: string;

	static from(user: User, passkeyRegistered: boolean): AdminUserDto {
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			emailVerified: user.emailVerified,
			twoFactorEnabled: user.twoFactorEnabled,
			passkeyRegistered,
			restrictedEvidenceAccess: user.restrictedEvidenceAccess,
			banned: user.banned,
			banReason: user.banReason,
			banExpires: user.banExpires?.toISOString() ?? null,
			createdAt: user.createdAt.toISOString(),
		};
	}
}

@ApiSchema({ name: 'AdminUserPage' })
export class AdminUserPageDto extends CursorPageDto<AdminUserDto> {
	@ApiProperty({ type: AdminUserDto, isArray: true })
	declare items: AdminUserDto[];
}

@ApiSchema({ name: 'SetRestrictedEvidenceAccess' })
export class SetRestrictedEvidenceAccessDto {
	@ApiProperty({
		description:
			'Whether the admin can read restricted abuse evidence; only admins who already hold it can change it',
	})
	@IsBoolean()
	granted: boolean;
}
