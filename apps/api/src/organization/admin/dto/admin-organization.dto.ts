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
} from '../../../common/dto/cursor-page.dto';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import type { Organization } from '../../tenant/entities/organization.entity';

const MAXIMUM_QUERY_LENGTH = 256;

@ApiSchema({ name: 'AdminOrganizationListQuery' })
export class AdminOrganizationListQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({ description: 'Name or slug fragment' })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(MAXIMUM_QUERY_LENGTH)
	query?: string;
}

@ApiSchema({ name: 'AdminOrganization' })
export class AdminOrganizationDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	slug: string;

	@ApiProperty()
	personal: boolean;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	createdBy: string | null;

	@ApiProperty()
	memberCount: number;

	@ApiProperty()
	suspended: boolean;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	suspendedAt: string | null;

	@ApiProperty({ type: String, nullable: true })
	suspensionReason: string | null;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	suspendedUntil: string | null;

	@ApiProperty()
	suspensionCleanupGracePeriodHours: number;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	deletedAt: string | null;

	@ApiProperty({ format: 'date-time' })
	createdAt: string;

	@ApiProperty()
	creditBalanceMicroUsd: string;

	static from(
		organization: Organization,
		memberCount: number,
		creditBalanceMicroUsd: MicroUsd
	): AdminOrganizationDto {
		return {
			id: organization.id,
			name: organization.name,
			slug: organization.slug,
			personal: organization.personal,
			createdBy: organization.createdBy,
			memberCount,
			suspended: organization.suspended,
			suspendedAt: organization.suspendedAt?.toISOString() ?? null,
			suspensionReason: organization.suspensionReason,
			suspendedUntil: organization.suspendedUntil?.toISOString() ?? null,
			suspensionCleanupGracePeriodHours:
				organization.suspensionCleanupGracePeriodHours,
			deletedAt: organization.deletedAt?.toISOString() ?? null,
			createdAt: organization.createdAt.toISOString(),
			creditBalanceMicroUsd: creditBalanceMicroUsd.toString(),
		};
	}
}

@ApiSchema({ name: 'AdminOrganizationPage' })
export class AdminOrganizationPageDto extends CursorPageDto<AdminOrganizationDto> {
	@ApiProperty({ type: AdminOrganizationDto, isArray: true })
	declare items: AdminOrganizationDto[];
}
