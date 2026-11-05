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
	IsBoolean,
	IsDefined,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import { IsSafeDisplayString } from '../../common/validators/is-safe-string.validator';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { SecretBindingDto } from '../../secrets/dto/secret.dto';
import { CreateBuildInfoDto } from '../../snapshot/dto/create-build-info.dto';
import {
	MAXIMUM_EGRESS_BANDWIDTH_BPS,
	MINIMUM_EGRESS_BANDWIDTH_BPS,
} from '../constants/network.constants';
import {
	DEFAULT_SANDBOX_OS_USER,
	EXAMPLE_SANDBOX_ARCHIVE_INTERVAL_MINUTES,
} from '../constants/sandbox.constants';
import { SandboxCapability } from '../enums/sandbox-capability.enum';
import { SandboxMode } from '../enums/sandbox-mode.enum';
import { SandboxVolume } from './sandbox.dto';
import { SandboxPlacementRequestDto } from './sandbox-placement.dto';

@ApiSchema({ name: 'CreateSandbox' })
export class CreateSandboxDto {
	@ApiPropertyOptional({
		description:
			'The name of the sandbox. If not provided, the sandbox ID will be used as the name',
		example: 'MySandbox',
	})
	@IsOptional()
	@IsString()
	@IsSafeDisplayString()
	name?: string;

	@ApiProperty({
		description:
			'Immutable workload mode. Ephemeral workloads use Firecracker; standard workloads use Cloud Hypervisor.',
		enum: SandboxMode,
		enumName: 'SandboxMode',
		example: SandboxMode.EPHEMERAL,
	})
	@IsDefined()
	@IsEnum(SandboxMode)
	mode: SandboxMode;

	@ApiPropertyOptional({
		description:
			'Guest platform capabilities to activate. Desktop also activates developer tools.',
		enum: SandboxCapability,
		enumName: 'SandboxCapability',
		isArray: true,
		example: [SandboxCapability.DESKTOP],
	})
	@IsOptional()
	@IsArray()
	@IsEnum(SandboxCapability, { each: true })
	capabilities?: SandboxCapability[];

	@ApiPropertyOptional({
		description: 'The ID or name of the snapshot used for the sandbox',
		example: 'ubuntu-4vcpu-8ram-100gb',
	})
	@IsOptional()
	@IsString()
	snapshot?: string;

	@ApiPropertyOptional({
		description: 'The user associated with the project',
		example: DEFAULT_SANDBOX_OS_USER,
		default: DEFAULT_SANDBOX_OS_USER,
	})
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	user?: string;

	@ApiPropertyOptional({
		description: 'Environment variables for the sandbox',
		type: 'object',
		additionalProperties: { type: 'string' },
		example: { NODE_ENV: 'production' },
	})
	@IsOptional()
	@IsObject()
	env?: { [key: string]: string };

	@ApiPropertyOptional({
		description:
			'Platform-managed secret bindings. Values are resolved only for transient machine delivery.',
		type: [SecretBindingDto],
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SecretBindingDto)
	secretEnv?: SecretBindingDto[];

	@ApiPropertyOptional({
		description: 'Labels for the sandbox',
		type: 'object',
		additionalProperties: { type: 'string' },
		example: { 'snapflow.io/public': 'true' },
	})
	@IsOptional()
	@IsObject()
	labels?: { [key: string]: string };

	@ApiPropertyOptional({
		description: 'Whether to block all network access for the sandbox',
		example: false,
	})
	@IsOptional()
	@IsBoolean()
	networkBlockAll?: boolean;

	@ApiPropertyOptional({
		description:
			'Comma-separated list of allowed CIDR network addresses for the sandbox',
		example: '192.168.1.0/16,10.0.0.0/24',
	})
	@IsOptional()
	@IsString()
	networkAllowList?: string;

	@ApiPropertyOptional({
		description: 'Comma-separated list of allowed domains for the sandbox',
		example: 'example.com,api.snapflow.io',
	})
	@IsOptional()
	@IsString()
	domainAllowList?: string;

	@ApiPropertyOptional({
		description: 'Maximum sandbox egress bandwidth in bits per second',
		example: 10_000_000,
		minimum: MINIMUM_EGRESS_BANDWIDTH_BPS,
		maximum: MAXIMUM_EGRESS_BANDWIDTH_BPS,
	})
	@IsOptional()
	@IsInt()
	@Min(MINIMUM_EGRESS_BANDWIDTH_BPS)
	@Max(MAXIMUM_EGRESS_BANDWIDTH_BPS)
	egressBandwidthBps?: number;

	@ApiPropertyOptional({
		description:
			'Where the sandbox runs: pinned to one machine, or any matching machine. Defaults to the best matching machine nearest to the caller.',
		type: SandboxPlacementRequestDto,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => SandboxPlacementRequestDto)
	placement?: SandboxPlacementRequestDto;

	@ApiPropertyOptional({
		description: 'CPU cores allocated to the sandbox',
		example: 2,
		type: 'integer',
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	cpu?: number;

	@ApiPropertyOptional({
		description: 'GPU units allocated to the sandbox',
		example: 1,
		type: 'integer',
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(1)
	gpu?: number;

	@ApiPropertyOptional({
		description:
			'Preferred GPU type for the sandbox. Accepts a single value or an ordered preference list — the scheduler tries each in order and pins the sandbox to the first that has capacity.',
		enum: GpuType,
		enumName: 'GpuType',
		isArray: true,
		example: [GpuType.H100],
	})
	@IsOptional()
	@Transform(({ value }) =>
		Array.isArray(value)
			? value.length === 0
				? undefined
				: value
			: value === undefined || value === null
				? value
				: [value]
	)
	@IsArray()
	@ArrayMinSize(1)
	@IsEnum(GpuType, { each: true })
	gpuType?: GpuType[];

	@ApiPropertyOptional({
		description: 'Memory allocated to the sandbox in GB',
		example: 1,
		type: 'integer',
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	memory?: number;

	@ApiPropertyOptional({
		description: 'Disk space allocated to the sandbox in GB',
		example: 3,
		type: 'integer',
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	disk?: number;

	@ApiPropertyOptional({
		description: 'Auto-stop interval in minutes (0 means disabled)',
		example: 30,
		type: 'integer',
	})
	@IsOptional()
	@IsNumber()
	autoStopInterval?: number;

	@ApiPropertyOptional({
		description:
			'Auto-archive interval in minutes (0 means the maximum interval will be used)',
		example: EXAMPLE_SANDBOX_ARCHIVE_INTERVAL_MINUTES,
		type: 'integer',
	})
	@IsOptional()
	@IsNumber()
	autoArchiveInterval?: number;

	@ApiPropertyOptional({
		description:
			'Auto-delete interval in minutes (negative value means disabled, 0 means delete immediately upon stopping)',
		example: 30,
		type: 'integer',
	})
	@IsOptional()
	@IsNumber()
	autoDeleteInterval?: number;

	@ApiPropertyOptional({
		description: 'Array of volumes to attach to the sandbox',
		type: [SandboxVolume],
		required: false,
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SandboxVolume)
	volumes?: SandboxVolume[];

	@ApiPropertyOptional({
		description: 'Build information for the sandbox',
		type: CreateBuildInfoDto,
	})
	@IsOptional()
	@IsObject()
	buildInfo?: CreateBuildInfoDto;

	@ApiPropertyOptional({
		description:
			'ID or name of an existing sandbox to link the new sandbox to. The new sandbox will be scheduled on the same machine as the linked sandbox so a local network can be established between them. Linked sandboxes must use ephemeral mode and cannot themselves be linked to another sandbox.',
		example: 'sandbox123',
	})
	@IsOptional()
	@IsString()
	linkedSandbox?: string;
}
