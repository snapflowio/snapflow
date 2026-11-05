/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import { SHA256_HEX_PATTERN } from '../../../usage/schemas/machine-usage-envelope.schema';
import {
	MACHINE_READINESS_REASON_MAX_LENGTH,
	MACHINE_SSH_HOST_PUBLIC_KEY_MAX_LENGTH,
} from '../constants/machine.constants';
import { MachineReadinessState } from '../enums/machine-readiness-state.enum';
import { MachineRuntimeCapabilitiesDto } from './machine-runtime-capabilities.dto';

@ApiSchema({ name: 'MachineReadiness' })
export class MachineReadinessDto {
	@ApiProperty({
		enum: MachineReadinessState,
		enumName: 'MachineReadinessState',
	})
	@IsEnum(MachineReadinessState)
	state: MachineReadinessState;

	@ApiPropertyOptional({
		description: 'Bounded host-safe reason when readiness failed',
	})
	@IsOptional()
	@IsString()
	@MaxLength(MACHINE_READINESS_REASON_MAX_LENGTH)
	reason?: string;
}

@ApiSchema({ name: 'MachineHealthMetrics' })
export class MachineHealthMetricsDto {
	@ApiProperty({
		description: 'Current CPU usage percentage',
		example: 45.5,
	})
	@IsNumber()
	currentCpuUsagePercentage: number;

	@ApiProperty({
		description: 'Current memory usage percentage',
		example: 60.2,
	})
	@IsNumber()
	currentMemoryUsagePercentage: number;

	@ApiProperty({
		description: 'Current disk usage percentage',
		example: 35.8,
	})
	@IsNumber()
	currentDiskUsagePercentage: number;

	@ApiProperty({
		description: 'Currently allocated CPU cores',
		example: 8,
	})
	@IsNumber()
	currentAllocatedCpu: number;

	@ApiProperty({
		description: 'Currently allocated memory in GiB',
		example: 16,
	})
	@IsNumber()
	currentAllocatedMemoryGiB: number;

	@ApiProperty({
		description: 'Currently allocated disk in GiB',
		example: 100,
	})
	@IsNumber()
	currentAllocatedDiskGiB: number;

	@ApiProperty({
		description: 'Number of snapshots currently stored',
		example: 5,
	})
	@IsNumber()
	currentSnapshotCount: number;

	@ApiProperty({
		description: 'Number of started sandboxes',
		example: 10,
	})
	@IsNumber()
	currentStartedSandboxes: number;

	@ApiProperty({
		description: 'Total CPU cores on the machine',
		example: 8,
	})
	@IsNumber()
	cpu: number;

	@ApiProperty({
		description: 'Total RAM in GiB on the machine',
		example: 16,
	})
	@IsNumber()
	memoryGiB: number;

	@ApiProperty({
		description:
			'Disk capacity in GiB the machine offers and admits workloads against',
		example: 100,
	})
	@IsNumber()
	diskGiB: number;

	@ApiProperty({
		description:
			'GPUs the machine can pass through to sandboxes and admits workloads against',
		example: 1,
		type: 'integer',
		minimum: 0,
	})
	@IsInt()
	@Min(0)
	passthroughGpuCount: number;
}

@ApiSchema({ name: 'MachineServiceHealth' })
export class MachineServiceHealthDto {
	@ApiProperty({
		description: 'Name of the service being checked',
		example: 'machine',
	})
	@IsString()
	serviceName: string;

	@ApiProperty({
		description: 'Whether the service is healthy',
		example: false,
	})
	@IsBoolean()
	healthy: boolean;

	@ApiPropertyOptional({
		description: 'Error reason if the service is unhealthy',
		example: 'Cannot connect to the machine',
	})
	@IsOptional()
	@IsString()
	errorReason?: string;
}

@ApiSchema({ name: 'MachineHealthcheck' })
export class MachineHealthcheckDto {
	@ApiPropertyOptional({
		description:
			'SHA-256 digest over the sorted machine hardware fingerprint components',
		pattern: SHA256_HEX_PATTERN.source,
	})
	@IsOptional()
	@Matches(SHA256_HEX_PATTERN)
	inventoryDigest?: string;

	@ApiProperty({ type: MachineReadinessDto })
	@ValidateNested()
	@Type(() => MachineReadinessDto)
	readiness: MachineReadinessDto;

	@ApiPropertyOptional({
		description: 'MicroVM machine, artifact, and runtime feature capabilities',
		type: MachineRuntimeCapabilitiesDto,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => MachineRuntimeCapabilitiesDto)
	runtimeCapabilities?: MachineRuntimeCapabilitiesDto;

	@ApiPropertyOptional({
		description: 'Machine metrics',
		type: MachineHealthMetricsDto,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => MachineHealthMetricsDto)
	metrics?: MachineHealthMetricsDto;

	@ApiPropertyOptional({
		description: 'Health status of individual services on the machine',
		type: [MachineServiceHealthDto],
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => MachineServiceHealthDto)
	serviceHealth?: MachineServiceHealthDto[];

	@ApiPropertyOptional({
		description:
			'Authorized-key representation of the SSH relay key on the machine',
	})
	@IsOptional()
	@IsString()
	@MaxLength(MACHINE_SSH_HOST_PUBLIC_KEY_MAX_LENGTH)
	sshHostPublicKey?: string;

	@ApiProperty({
		description: 'Snapflow version',
		example: 'v0.0.0-dev',
	})
	@IsString()
	appVersion: string;
}
