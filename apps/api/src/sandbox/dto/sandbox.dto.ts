/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { wrap } from '@mikro-orm/core';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	IsEnum,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
} from 'class-validator';
import { LocationDto } from '../../location/dto/location.dto';
import { EXAMPLE_SANDBOX_ARCHIVE_INTERVAL_MINUTES } from '../constants/sandbox.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxCapability } from '../enums/sandbox-capability.enum';
import { SandboxClass } from '../enums/sandbox-class.enum';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxMode } from '../enums/sandbox-mode.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { GpuType } from '../machine/enums/gpu-type.enum';
import { sandboxPlacementDto } from '../placement/utils/sandbox-placement.util';
import { BuildInfoDto } from '../snapshot/dto/build-info.dto';
import type { SandboxVolumeMount } from '../types/sandbox-storage.types';
import { deriveSandboxResponseState } from '../utils/sandbox-response-state.util';
import { BackupState } from '../volume/enums/backup-state.enum';
import { SandboxPlacementDto } from './sandbox-placement.dto';

function isoTimestamp(value: Date | null | undefined): string | undefined {
	return value ? new Date(value).toISOString() : undefined;
}

function buildInfoSummary(sandbox: Sandbox): BuildInfoDto | undefined {
	const { buildInfo } = sandbox;
	if (!buildInfo || !wrap(buildInfo).isInitialized()) {
		return undefined;
	}
	return {
		dockerfileContent: buildInfo.dockerfileContent ?? undefined,
		contextHashes: buildInfo.contextHashes ?? undefined,
		createdAt: buildInfo.createdAt,
		updatedAt: buildInfo.updatedAt,
		snapshotRef: buildInfo.snapshotRef,
	};
}

@ApiSchema({ name: 'SandboxVolume' })
export class SandboxVolume implements SandboxVolumeMount {
	@ApiProperty({
		description:
			'The ID or name of the volume. Resolved to the volume ID on sandbox create.',
		example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
	})
	@IsString()
	@IsNotEmpty()
	volumeId: string;

	@ApiProperty({
		description: 'The mount path for the volume',
		example: '/data',
	})
	@IsString()
	mountPath: string;

	@ApiPropertyOptional({
		description:
			'Optional relative directory within the block volume to mount. When omitted, the entire volume is mounted.',
		example: 'users/alice',
	})
	@IsOptional()
	@IsString()
	subpath?: string;
}

@ApiSchema({ name: 'Sandbox' })
export class SandboxDto {
	@ApiProperty({
		description: 'The ID of the sandbox',
		example: 'sandbox123',
	})
	id: string;

	@ApiProperty({
		description: 'The ID of the organization that owns the sandbox',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	organizationId: string;

	@ApiProperty({
		description: 'The name of the sandbox',
		example: 'MySandbox',
	})
	name: string;

	@ApiProperty({
		description:
			'Immutable workload mode. Ephemeral workloads use Firecracker; standard workloads use Cloud Hypervisor.',
		enum: SandboxMode,
		enumName: 'SandboxMode',
		example: SandboxMode.EPHEMERAL,
	})
	@IsEnum(SandboxMode)
	mode: SandboxMode;

	@ApiProperty({
		description: 'Guest platform capabilities enabled for the sandbox.',
		enum: SandboxCapability,
		enumName: 'SandboxCapability',
		isArray: true,
	})
	capabilities: SandboxCapability[];

	@ApiPropertyOptional({
		description: 'The snapshot used for the sandbox',
		example: 'snapflowio/sandbox:latest',
	})
	snapshot?: string;

	@ApiProperty({
		description: 'The user associated with the project',
		example: 'snapflow',
	})
	user: string;

	@ApiProperty({
		description: 'Environment variables for the sandbox',
		type: 'object',
		additionalProperties: { type: 'string' },
		example: { NODE_ENV: 'production' },
	})
	env: Record<string, string>;

	@ApiProperty({
		description: 'Labels for the sandbox',
		type: 'object',
		additionalProperties: { type: 'string' },
		example: { 'snapflow.io/public': 'true' },
	})
	labels: { [key: string]: string };

	@ApiProperty({
		description: 'Whether to block all network access for the sandbox',
		example: false,
	})
	networkBlockAll: boolean;

	@ApiPropertyOptional({
		description:
			'Comma-separated list of allowed CIDR network addresses for the sandbox',
		example: '192.168.1.0/16,10.0.0.0/24',
	})
	networkAllowList?: string;

	@ApiPropertyOptional({
		description: 'Comma-separated list of allowed domains for the sandbox',
		example: 'example.com,*.snapflow.io',
	})
	domainAllowList?: string;

	@ApiPropertyOptional({
		description: 'Maximum egress bandwidth in bits per second',
		nullable: true,
		type: Number,
	})
	egressBandwidthBps?: number | null;

	@ApiPropertyOptional({
		description:
			'Fair-use egress limit in bits per second, set while the monthly egress cap is exceeded',
		nullable: true,
		type: Number,
	})
	networkThrottleBandwidthBps?: number | null;

	@ApiProperty({
		description: 'Where the sandbox may run',
		type: SandboxPlacementDto,
	})
	placement: SandboxPlacementDto;

	@ApiProperty({
		description:
			'Where the machine the sandbox is placed on is; null before placement or while the machine location is unknown',
		type: LocationDto,
		nullable: true,
	})
	location: LocationDto | null;

	@ApiProperty({
		description: 'The CPU quota for the sandbox',
		example: 2,
	})
	cpu: number;

	@ApiProperty({
		description: 'The GPU quota for the sandbox',
		example: 0,
	})
	gpu: number;

	@ApiPropertyOptional({
		description: 'The GPU type assigned to the sandbox',
		enum: GpuType,
		enumName: 'GpuType',
		example: GpuType.H100,
	})
	@IsEnum(GpuType)
	@IsOptional()
	gpuType?: GpuType;

	@ApiProperty({
		description: 'The memory quota for the sandbox',
		example: 4,
	})
	memory: number;

	@ApiProperty({
		description: 'The disk quota for the sandbox',
		example: 10,
	})
	disk: number;

	@ApiPropertyOptional({
		description: 'The state of the sandbox',
		enum: SandboxState,
		enumName: 'SandboxState',
		example: Object.values(SandboxState)[0],
		required: false,
	})
	@IsEnum(SandboxState)
	@IsOptional()
	state?: SandboxState;

	@ApiPropertyOptional({
		description: 'The desired state of the sandbox',
		enum: SandboxDesiredState,
		enumName: 'SandboxDesiredState',
		example: Object.values(SandboxDesiredState)[0],
		required: false,
	})
	@IsEnum(SandboxDesiredState)
	@IsOptional()
	desiredState?: SandboxDesiredState;

	@ApiPropertyOptional({
		description: 'The error reason of the sandbox',
		example: 'The sandbox is not running',
		required: false,
	})
	@IsOptional()
	errorReason?: string;

	@ApiPropertyOptional({
		description: 'Whether the sandbox error is recoverable.',
		example: true,
		required: false,
	})
	@IsOptional()
	recoverable?: boolean;

	@ApiPropertyOptional({
		description: 'The state of the backup',
		enum: BackupState,
		enumName: 'BackupState',
		example: Object.values(BackupState)[0],
		required: false,
	})
	@IsEnum(BackupState)
	@IsOptional()
	backupState?: BackupState;

	@ApiPropertyOptional({
		description: 'The failure reason for the most recent backup attempt',
		example: 'Backup upload timed out',
		required: false,
	})
	@IsOptional()
	backupErrorReason?: string;

	@ApiPropertyOptional({
		description: 'The creation timestamp of the last backup',
		example: '2024-10-01T12:00:00Z',
		required: false,
	})
	@IsOptional()
	backupCreatedAt?: string;

	@ApiPropertyOptional({
		description: 'Auto-stop interval in minutes (0 means disabled)',
		example: 30,
		required: false,
	})
	@IsOptional()
	autoStopInterval?: number;

	@ApiPropertyOptional({
		description: 'Auto-archive interval in minutes',
		example: EXAMPLE_SANDBOX_ARCHIVE_INTERVAL_MINUTES,
		required: false,
	})
	@IsOptional()
	autoArchiveInterval?: number;

	@ApiPropertyOptional({
		description:
			'Auto-delete interval in minutes (negative value means disabled, 0 means delete immediately upon stopping)',
		example: 30,
		required: false,
	})
	@IsOptional()
	autoDeleteInterval?: number;

	@ApiPropertyOptional({
		description: 'Array of volumes attached to the sandbox',
		type: [SandboxVolume],
		required: false,
	})
	@IsOptional()
	volumes?: SandboxVolume[];

	@ApiPropertyOptional({
		description: 'Build information for the sandbox',
		type: BuildInfoDto,
		required: false,
	})
	@IsOptional()
	buildInfo?: BuildInfoDto;

	@ApiPropertyOptional({
		description: 'The creation timestamp of the sandbox',
		example: '2024-10-01T12:00:00Z',
		required: false,
	})
	@IsOptional()
	createdAt?: string;

	@ApiPropertyOptional({
		description: 'The last update timestamp of the sandbox',
		example: '2024-10-01T12:00:00Z',
		required: false,
	})
	@IsOptional()
	updatedAt?: string;

	@ApiPropertyOptional({
		description: 'The last activity timestamp of the sandbox',
		example: '2024-10-01T12:00:00Z',
		required: false,
	})
	@IsOptional()
	lastActivityAt?: string;

	@ApiPropertyOptional({
		description: 'The class of the sandbox',
		enum: SandboxClass,
		enumName: 'SandboxClass',
		example: SandboxClass.LINUX_VM,
		required: false,
	})
	@IsEnum(SandboxClass)
	@IsOptional()
	sandboxClass?: SandboxClass;

	@ApiPropertyOptional({
		description: 'The version of the daemon running in the sandbox',
		example: '1.0.0',
		required: false,
	})
	@IsOptional()
	daemonVersion?: string;

	@ApiPropertyOptional({
		description: 'The machine ID of the sandbox',
		example: 'machine123',
		required: false,
	})
	@IsOptional()
	machineId?: string;

	@ApiPropertyOptional({
		description:
			'ID of the sandbox this sandbox is linked to. When set, the sandbox is co-located on the same machine as the linked sandbox.',
		example: 'sandbox123',
		required: false,
	})
	@IsOptional()
	linkedSandboxId?: string;

	static from(sandbox: Sandbox): SandboxDto {
		return {
			id: sandbox.id,
			organizationId: sandbox.organizationId,
			name: sandbox.name,
			mode: sandbox.mode,
			capabilities: sandbox.capabilities,
			location: LocationDto.from(sandbox),
			snapshot: sandbox.snapshot ?? undefined,
			user: sandbox.osUser,
			env: sandbox.env,
			cpu: sandbox.cpu,
			gpu: sandbox.gpu,
			gpuType: sandbox.gpuType ?? undefined,
			memory: sandbox.mem,
			disk: sandbox.disk,
			networkBlockAll: sandbox.networkBlockAll,
			networkAllowList: sandbox.networkAllowList ?? undefined,
			domainAllowList: sandbox.domainAllowList ?? undefined,
			egressBandwidthBps: sandbox.egressBandwidthBps,
			networkThrottleBandwidthBps: sandbox.networkThrottleBandwidthBps,
			placement: sandboxPlacementDto(sandbox),
			labels: sandbox.labels ?? {},
			volumes: sandbox.volumes,
			state: deriveSandboxResponseState(sandbox.state, sandbox.desiredState),
			desiredState: sandbox.desiredState,
			errorReason: sandbox.errorReason ?? undefined,
			recoverable: sandbox.recoverable,
			backupState: sandbox.backupState,
			backupErrorReason: sandbox.backupErrorReason ?? undefined,
			backupCreatedAt: isoTimestamp(sandbox.lastBackupAt),
			autoStopInterval: sandbox.autoStopInterval,
			autoArchiveInterval: sandbox.autoArchiveInterval,
			autoDeleteInterval: sandbox.autoDeleteInterval,
			sandboxClass: sandbox.sandboxClass,
			createdAt: isoTimestamp(sandbox.createdAt),
			updatedAt: isoTimestamp(sandbox.updatedAt),
			lastActivityAt: isoTimestamp(sandbox.lastActivityAt?.lastActivityAt),
			buildInfo: buildInfoSummary(sandbox),
			daemonVersion: sandbox.daemonVersion ?? undefined,
			machineId: sandbox.machineId ?? undefined,
			linkedSandboxId: sandbox.linkedSandboxId ?? undefined,
		};
	}
}

@ApiSchema({ name: 'SandboxLabels' })
export class SandboxLabelsDto {
	@ApiProperty({
		description: 'Key-value pairs of labels',
		example: { environment: 'dev', team: 'backend' },
		type: 'object',
		additionalProperties: { type: 'string' },
	})
	@IsObject()
	labels: { [key: string]: string };
}
