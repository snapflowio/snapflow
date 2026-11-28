/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
} from 'class-validator';
import { EnumArrayQuery } from '../../common/decorators/enum-array-query.decorator';
import { SearchQuery } from '../../common/decorators/search-query.decorator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import type { Machine } from '../../machine/entities/machine.entity';
import { MachineUtilizationDto } from '../../marketplace/dto/host-machine.dto';
import { MachineCategory } from '../../marketplace/enums/machine-category.enum';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import type { MachineUtilization } from '../../marketplace/queries/machine-utilization.query';
import { AdminListingFlag } from '../enums/admin-listing-flag.enum';

const TIER_REASON_MAXIMUM_LENGTH = 255;

@ApiSchema({ name: 'AdminListing' })
export class AdminListingDto {
	@ApiProperty({ format: 'uuid' }) machineId: string;
	@ApiProperty({ format: 'uuid' }) organizationId: string;
	@ApiProperty({ enum: MachineTier, enumName: 'MachineTier' })
	tier: MachineTier;
	@ApiProperty({ type: [String] }) tierReasons: string[];
	@ApiProperty({ enum: MachineTier, enumName: 'MachineTier', nullable: true })
	adminTierCap: MachineTier | null;
	@ApiProperty({ type: String, nullable: true })
	adminTierCapReason: string | null;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	datacenterApprovedAt: Date | null;
	@ApiProperty({
		enum: MachineCategory,
		enumName: 'MachineCategory',
		nullable: true,
	})
	category: MachineCategory | null;
	@ApiProperty() fingerprintConflict: boolean;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	restrictedAt: Date | null;
	@ApiProperty({ type: String, nullable: true })
	restrictionReason: string | null;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	measuredAt: Date | null;
	@ApiProperty({ type: MachineUtilizationDto })
	utilization: MachineUtilizationDto;

	static from(
		machine: Machine,
		utilization: MachineUtilization
	): AdminListingDto {
		return {
			machineId: machine.id,
			organizationId: machine.organizationId,
			tier: machine.tier,
			tierReasons: machine.tierReasons,
			adminTierCap: machine.adminTierCap,
			adminTierCapReason: machine.adminTierCapReason,
			datacenterApprovedAt: machine.datacenterApprovedAt,
			category: machine.category,
			fingerprintConflict: machine.fingerprintConflict,
			restrictedAt: machine.restrictedAt,
			restrictionReason: machine.restrictionReason,
			measuredAt: machine.measuredAt,
			utilization,
		};
	}
}

@ApiSchema({ name: 'AdminListingPage' })
export class AdminListingPageDto extends CursorPageDto<AdminListingDto> {
	@ApiProperty({ type: AdminListingDto, isArray: true })
	declare items: AdminListingDto[];
}

@ApiSchema({ name: 'ListAdminListingsQuery' })
export class ListAdminListingsQueryDto extends CursorPageQueryDto {
	@SearchQuery('Machine or organization ID fragment')
	query?: string;

	@EnumArrayQuery({
		enum: MachineTier,
		enumName: 'MachineTier',
		description: 'Tiers to include',
	})
	tiers?: MachineTier[];

	@EnumArrayQuery({
		enum: AdminListingFlag,
		enumName: 'AdminListingFlag',
		description: 'Include listings raising any of these flags',
	})
	flags?: AdminListingFlag[];
}

@ApiSchema({ name: 'UpdateAdminMachineTier' })
export class UpdateAdminMachineTierDto {
	@ApiPropertyOptional({
		enum: MachineTier,
		enumName: 'MachineTier',
		nullable: true,
		description: 'Highest tier the machine may hold; null removes the cap',
	})
	@IsOptional()
	@IsEnum(MachineTier)
	tierCap?: MachineTier | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	datacenterApproved?: boolean;

	@ApiProperty({ maxLength: TIER_REASON_MAXIMUM_LENGTH })
	@IsString()
	@IsNotEmpty()
	@MaxLength(TIER_REASON_MAXIMUM_LENGTH)
	reason: string;
}
