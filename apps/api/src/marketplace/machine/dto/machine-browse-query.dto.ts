/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	Max,
	Min,
} from 'class-validator';
import {
	BASIS_POINTS_SCALE,
	MICRO_USD_PATTERN,
} from '../../../common/constants/money.constants';
import { PageLimit } from '../../../common/decorators/page-limit.decorator';
import { ToArray } from '../../../common/decorators/to-array.decorator';
import { IsLocationCode } from '../../../location/validators/is-location-code.validator';
import {
	DEFAULT_SANDBOX_CPU,
	DEFAULT_SANDBOX_DISK_GIB,
	DEFAULT_SANDBOX_GPU,
	DEFAULT_SANDBOX_MEMORY_GIB,
} from '../../../sandbox/instance/constants/sandbox.constants';
import { GpuType } from '../../../sandbox/machine/enums/gpu-type.enum';
import { MACHINE_BROWSE_PAGE_LIMIT } from '../constants/marketplace.constants';
import { MachineBrowseSort } from '../enums/machine-browse-sort.enum';
import { MachineCategory } from '../enums/machine-category.enum';
import { MachineTier } from '../enums/machine-tier.enum';

const QUERY_TRUE = 'true';
const MINIMUM_SHAPE_RESOURCE = 1;
const MINIMUM_GPU = 0;

function queryBoolean() {
	return Transform(({ value }) => value === QUERY_TRUE || value === true);
}

@ApiSchema({ name: 'MachineShapeQuery' })
export class MachineShapeQueryDto {
	@ApiPropertyOptional({
		type: Number,
		minimum: MINIMUM_SHAPE_RESOURCE,
		default: DEFAULT_SANDBOX_CPU,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(MINIMUM_SHAPE_RESOURCE)
	cpu: number = DEFAULT_SANDBOX_CPU;

	@ApiPropertyOptional({
		type: Number,
		minimum: MINIMUM_SHAPE_RESOURCE,
		default: DEFAULT_SANDBOX_MEMORY_GIB,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(MINIMUM_SHAPE_RESOURCE)
	memoryGiB: number = DEFAULT_SANDBOX_MEMORY_GIB;

	@ApiPropertyOptional({
		type: Number,
		minimum: MINIMUM_SHAPE_RESOURCE,
		default: DEFAULT_SANDBOX_DISK_GIB,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(MINIMUM_SHAPE_RESOURCE)
	diskGiB: number = DEFAULT_SANDBOX_DISK_GIB;

	@ApiPropertyOptional({
		type: Number,
		minimum: MINIMUM_GPU,
		default: DEFAULT_SANDBOX_GPU,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(MINIMUM_GPU)
	gpu: number = DEFAULT_SANDBOX_GPU;
}

@ApiSchema({ name: 'ListListingsQuery' })
export class ListListingsQueryDto extends MachineShapeQueryDto {
	@ApiPropertyOptional({ enum: GpuType, enumName: 'GpuType', isArray: true })
	@IsOptional()
	@ToArray()
	@IsArray()
	@IsEnum(GpuType, { each: true })
	gpuType?: GpuType[];

	@ApiPropertyOptional({ enum: MachineCategory, enumName: 'MachineCategory' })
	@IsOptional()
	@IsEnum(MachineCategory)
	category?: MachineCategory;

	@ApiPropertyOptional({
		type: [String],
		description:
			'Continents (e.g. europe) or ISO 3166-1 alpha-2 countries (e.g. DE) to list machines in',
	})
	@IsOptional()
	@ToArray()
	@IsArray()
	@IsLocationCode({ each: true })
	locations?: string[];

	@ApiPropertyOptional({ enum: MachineTier, enumName: 'MachineTier' })
	@IsOptional()
	@IsEnum(MachineTier)
	minimumTier?: MachineTier;

	@ApiPropertyOptional({
		type: String,
		description: 'Highest all-in hourly price for the shape',
	})
	@IsOptional()
	@Matches(MICRO_USD_PATTERN)
	maxHourlyPriceMicroUsd?: string;

	@ApiPropertyOptional({
		type: String,
		description: 'Highest all-in egress price, micro-USD per GiB',
	})
	@IsOptional()
	@Matches(MICRO_USD_PATTERN)
	maxEgressMicroUsdPerGiB?: string;

	@ApiPropertyOptional({
		type: Number,
		minimum: 0,
		maximum: BASIS_POINTS_SCALE,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(BASIS_POINTS_SCALE)
	minimumReliabilityBasisPoints?: number;

	@ApiPropertyOptional({ type: Boolean, default: false })
	@IsOptional()
	@queryBoolean()
	@IsBoolean()
	persistentVolumes = false;

	@ApiPropertyOptional({ type: Boolean, default: false })
	@IsOptional()
	@queryBoolean()
	@IsBoolean()
	includeUnavailable = false;

	@ApiPropertyOptional({
		enum: MachineBrowseSort,
		enumName: 'MachineBrowseSort',
		default: MachineBrowseSort.PRICE,
	})
	@IsOptional()
	@IsEnum(MachineBrowseSort)
	sort: MachineBrowseSort = MachineBrowseSort.PRICE;

	@ApiPropertyOptional({
		type: String,
		description: 'Opaque cursor returned by the previous page',
	})
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	cursor?: string;

	@PageLimit(
		MACHINE_BROWSE_PAGE_LIMIT.DEFAULT,
		MACHINE_BROWSE_PAGE_LIMIT.MAXIMUM
	)
	limit: number = MACHINE_BROWSE_PAGE_LIMIT.DEFAULT;
}
