/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { SandboxClass } from '../../../sandbox/instance/enums/sandbox-class.enum';
import { GpuType } from '../../../sandbox/machine/enums/gpu-type.enum';

@ApiSchema({ name: 'UpdateOrganizationQuota' })
export class UpdateOrganizationQuotaDto {
	@ApiPropertyOptional({ enum: SandboxClass, enumName: 'SandboxClass' })
	@IsOptional()
	@IsEnum(SandboxClass)
	sandboxClass?: SandboxClass;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	totalCpuQuota?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	totalMemoryQuota?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	totalDiskQuota?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	totalGpuQuota?: number;

	@ApiPropertyOptional({
		enum: GpuType,
		enumName: 'GpuType',
		isArray: true,
		nullable: true,
	})
	@IsOptional()
	@IsArray()
	@IsEnum(GpuType, { each: true })
	allowedGpuTypes?: GpuType[] | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsNumber()
	@IsOptional()
	maxCpuPerSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsNumber()
	@IsOptional()
	maxMemoryPerSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsNumber()
	@IsOptional()
	maxDiskPerSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsNumber()
	@IsOptional()
	maxDiskPerNonEphemeralSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsNumber()
	@IsOptional()
	maxCpuPerGpuSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsNumber()
	@IsOptional()
	maxMemoryPerGpuSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsNumber()
	@IsOptional()
	maxDiskPerGpuSandbox?: number | null;
}
