/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { LocationDto } from '../../location/dto/location.dto';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { BackupState } from '../../volume/enums/backup-state.enum';
import { EXAMPLE_SANDBOX_ARCHIVE_INTERVAL_MINUTES } from '../constants/sandbox.constants';
import { SandboxClass } from '../enums/sandbox-class.enum';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxMode } from '../enums/sandbox-mode.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { deriveSandboxResponseState } from '../utils/sandbox-response-state.util';

interface SandboxListItemDtoFields {
	id: string;
	organizationId: string;
	name: string;
	mode: SandboxMode;
	location: LocationDto | null;
	machineId?: string;
	sandboxClass?: SandboxClass;
	state: SandboxState;
	desiredState?: SandboxDesiredState;
	snapshot?: string;
	user: string;
	errorReason?: string;
	recoverable?: boolean;
	cpu: number;
	gpu: number;
	gpuType?: GpuType;
	memory: number;
	disk: number;
	labels: { [key: string]: string };
	backupState?: BackupState;
	autoStopInterval?: number;
	autoArchiveInterval?: number;
	autoDeleteInterval?: number;
	createdAt?: string;
	updatedAt?: string;
	lastActivityAt?: string;
	daemonVersion?: string;
}

@ApiSchema({ name: 'SandboxListItem' })
export class SandboxListItemDto {
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
		description:
			'Where the machine the sandbox is placed on is; null before placement or while the machine location is unknown',
		type: LocationDto,
		nullable: true,
	})
	location: LocationDto | null;

	@ApiPropertyOptional({
		description: 'The machine ID of the sandbox',
		example: 'machine123',
		required: false,
	})
	@IsOptional()
	machineId?: string;

	@ApiPropertyOptional({
		description: 'The class of the sandbox',
		enum: SandboxClass,
		enumName: 'SandboxClass',
		example: Object.values(SandboxClass)[0],
		required: false,
	})
	@IsEnum(SandboxClass)
	@IsOptional()
	sandboxClass?: SandboxClass;

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
		description: 'The snapshot used for the sandbox',
		example: 'snapflowio/sandbox:latest',
	})
	snapshot?: string;

	@ApiProperty({
		description: 'The user associated with the project',
		example: 'snapflow',
	})
	user: string;

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

	@ApiProperty({
		description: 'Labels for the sandbox',
		type: 'object',
		additionalProperties: { type: 'string' },
		example: { 'snapflow.io/public': 'true' },
	})
	labels: { [key: string]: string };

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
		description: 'The version of the daemon running in the sandbox',
		example: '1.0.0',
		required: false,
	})
	@IsOptional()
	daemonVersion?: string;

	constructor({
		id,
		organizationId,
		name,
		mode,
		location,
		machineId,
		sandboxClass,
		state,
		desiredState,
		snapshot,
		user,
		errorReason,
		recoverable,
		cpu,
		gpu,
		gpuType,
		memory,
		disk,
		labels,
		backupState,
		autoStopInterval,
		autoArchiveInterval,
		autoDeleteInterval,
		createdAt,
		updatedAt,
		lastActivityAt,
		daemonVersion,
	}: SandboxListItemDtoFields) {
		this.id = id;
		this.organizationId = organizationId;
		this.name = name;
		this.mode = mode;
		this.location = location;
		this.machineId = machineId;
		this.sandboxClass = sandboxClass;
		this.state = deriveSandboxResponseState(state, desiredState);
		this.desiredState = desiredState;
		this.snapshot = snapshot;
		this.user = user;
		this.errorReason = errorReason;
		this.recoverable = recoverable;
		this.cpu = cpu;
		this.gpu = gpu;
		this.gpuType = gpuType;
		this.memory = memory;
		this.disk = disk;
		this.labels = labels;
		this.backupState = backupState;
		this.autoStopInterval = autoStopInterval;
		this.autoArchiveInterval = autoArchiveInterval;
		this.autoDeleteInterval = autoDeleteInterval;
		this.createdAt = createdAt;
		this.updatedAt = updatedAt;
		this.lastActivityAt = lastActivityAt;
		this.daemonVersion = daemonVersion;
	}
}
