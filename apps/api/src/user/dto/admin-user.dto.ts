/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import type { User } from '../entities/user.entity';
import { SystemRole } from '../enums/system-role.enum';

const MAXIMUM_QUERY_LENGTH = 256;

@ApiSchema({ name: 'AdminUserListQuery' })
export class AdminUserListQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({ description: 'Name or email fragment' })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(MAXIMUM_QUERY_LENGTH)
	query?: string;
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
