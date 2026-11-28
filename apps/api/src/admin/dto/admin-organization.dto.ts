/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
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
import type { MicroUsd } from '../../common/values/micro-usd.value';
import type { Organization } from '../../organization/entities/organization.entity';
import { AdminOrganizationSortField } from '../enums/admin-organization-sort-field.enum';
import { AdminOrganizationStatus } from '../enums/admin-organization-status.enum';
import { AdminOrganizationType } from '../enums/admin-organization-type.enum';

const DEFAULT_SORT_FIELD = AdminOrganizationSortField.CREATED_AT;
const DEFAULT_SORT_DIRECTION = SortDirection.DESC;

@ApiSchema({ name: 'AdminOrganizationListQuery' })
export class AdminOrganizationListQueryDto extends CursorPageQueryDto {
	@SearchQuery('Name or slug fragment')
	query?: string;

	@EnumArrayQuery({
		enum: AdminOrganizationType,
		enumName: 'AdminOrganizationType',
		description: 'Organization types to include',
	})
	types?: AdminOrganizationType[];

	@EnumArrayQuery({
		enum: AdminOrganizationStatus,
		enumName: 'AdminOrganizationStatus',
		description: 'Organization statuses to include',
	})
	statuses?: AdminOrganizationStatus[];

	@SortFieldQuery({
		enum: AdminOrganizationSortField,
		enumName: 'AdminOrganizationSortField',
		default: DEFAULT_SORT_FIELD,
	})
	sort = DEFAULT_SORT_FIELD;

	@SortDirectionQuery(DEFAULT_SORT_DIRECTION)
	order = DEFAULT_SORT_DIRECTION;
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
