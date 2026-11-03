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
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../../common/dto/cursor-page.dto';
import { MachineCategory } from '../../../marketplace/machine/enums/machine-category.enum';
import { MachineTier } from '../../../marketplace/machine/enums/machine-tier.enum';
import type { Machine } from '../../../sandbox/machine/entities/machine.entity';

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

	static from(machine: Machine): AdminListingDto {
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
	@ApiPropertyOptional({ enum: MachineTier, enumName: 'MachineTier' })
	@IsOptional()
	@IsEnum(MachineTier)
	tier?: MachineTier;
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
