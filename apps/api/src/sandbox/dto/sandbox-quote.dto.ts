/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import { BillingRestriction } from '../../billing/enums/billing-restriction.enum';
import { LocationDto } from '../../location/dto/location.dto';
import { MachineUnavailableReason } from '../../marketplace/enums/machine-unavailable-reason.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { GpuType } from '../machine/enums/gpu-type.enum';
import { SandboxPlacementRequestDto } from './sandbox-placement.dto';

@ApiSchema({ name: 'SandboxQuoteRequest' })
export class SandboxQuoteRequestDto {
	@ApiProperty({ type: SandboxPlacementRequestDto })
	@ValidateNested()
	@Type(() => SandboxPlacementRequestDto)
	placement: SandboxPlacementRequestDto;

	@ApiPropertyOptional({
		description:
			'Snapshot (ID or name) whose resources are quoted; resources must then be omitted',
	})
	@IsOptional()
	@IsString()
	snapshot?: string;

	@ApiPropertyOptional({ type: 'integer', minimum: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	cpu?: number;

	@ApiPropertyOptional({ type: 'integer', minimum: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	memory?: number;

	@ApiPropertyOptional({ type: 'integer', minimum: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	disk?: number;

	@ApiPropertyOptional({ type: 'integer', minimum: 0, maximum: 1 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(1)
	gpu?: number;

	@ApiPropertyOptional({
		enum: GpuType,
		enumName: 'GpuType',
		isArray: true,
	})
	@IsOptional()
	@Transform(({ value }) =>
		Array.isArray(value) || value === undefined || value === null
			? value
			: [value]
	)
	@IsArray()
	@ArrayMinSize(1)
	@IsEnum(GpuType, { each: true })
	gpuType?: GpuType[];
}

@ApiSchema({ name: 'SandboxPlacementAlternative' })
export class SandboxPlacementAlternativeDto {
	@ApiProperty({ format: 'uuid' }) machineId: string;
	@ApiProperty({ type: LocationDto, nullable: true })
	location: LocationDto | null;
	@ApiPropertyOptional({ format: 'uuid' }) priceCardId?: string;
	@ApiProperty() hourlyPriceMicroUsd: string;
	@ApiProperty() reliabilityBasisPoints: number;
}

@ApiSchema({ name: 'SandboxQuote' })
export class SandboxQuoteDto {
	@ApiProperty({ enum: PlacementKind, enumName: 'PlacementKind' })
	placementKind: PlacementKind;

	@ApiProperty() available: boolean;

	@ApiPropertyOptional({
		enum: MachineUnavailableReason,
		enumName: 'MachineUnavailableReason',
	})
	unavailableReason?: MachineUnavailableReason;

	@ApiPropertyOptional({
		enum: BillingRestriction,
		enumName: 'BillingRestriction',
	})
	billingRestriction?: BillingRestriction;

	@ApiProperty() eligibleMachineCount: number;

	@ApiPropertyOptional({ format: 'uuid' }) machineId?: string;

	@ApiPropertyOptional({
		format: 'uuid',
		description:
			'Absent when the sandbox would run unpriced on a machine of its organization',
	})
	priceCardId?: string;

	@ApiProperty() hourlyPriceMicroUsd: string;
	@ApiProperty() hostHourlyMicroUsd: string;
	@ApiProperty() markupHourlyMicroUsd: string;
	@ApiProperty() markupBasisPoints: number;
	@ApiProperty() stoppedHourlyPriceMicroUsd: string;
	@ApiProperty() dailyPriceMicroUsd: string;
	@ApiProperty() monthlyPriceMicroUsd: string;
	@ApiProperty() minimumFundingMicroUsd: string;
	@ApiProperty() priceLockDays: number;
}
