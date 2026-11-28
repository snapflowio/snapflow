/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { ORGANIZATION_QUOTA_MINIMUM } from '../constants/organization-limits.constants';

@ApiSchema({ name: 'CreateOrganizationQuota' })
export class CreateOrganizationQuotaDto {
	@ApiProperty({ enum: SandboxClass, enumName: 'SandboxClass' })
	@IsEnum(SandboxClass)
	sandboxClass: SandboxClass;

	@ApiPropertyOptional({
		type: Number,
		nullable: true,
		description:
			'vCPUs the organization may run at once; the larger of this and its quota tier applies, and null leaves the tier limit',
	})
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	@IsOptional()
	totalCpuQuota?: number | null;

	@ApiProperty()
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	totalMemoryQuota: number;

	@ApiProperty()
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	totalDiskQuota: number;

	@ApiProperty()
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	totalGpuQuota: number;

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
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	@IsOptional()
	maxCpuPerSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	@IsOptional()
	maxMemoryPerSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	@IsOptional()
	maxDiskPerSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	@IsOptional()
	maxDiskPerNonEphemeralSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	@IsOptional()
	maxCpuPerGpuSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	@IsOptional()
	maxMemoryPerGpuSandbox?: number | null;

	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsInt()
	@Min(ORGANIZATION_QUOTA_MINIMUM)
	@IsOptional()
	maxDiskPerGpuSandbox?: number | null;
}
