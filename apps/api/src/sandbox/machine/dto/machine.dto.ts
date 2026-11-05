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
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../../common/dto/cursor-page.dto';
import { LocationDto } from '../../../location/dto/location.dto';
import { IsLocationCode } from '../../../location/validators/is-location-code.validator';
import { SandboxClass } from '../../enums/sandbox-class.enum';
import { Machine } from '../entities/machine.entity';
import { MachineState } from '../enums/machine-state.enum';
import { MachineServiceHealthDto } from './machine-health.dto';
import { MachineRuntimeCapabilitiesDto } from './machine-runtime-capabilities.dto';
import { MachineUpdateStatusDto } from './machine-update-status.dto';

@ApiSchema({ name: 'Machine' })
export class MachineDto {
	@ApiProperty({
		description: 'The ID of the machine',
		example: 'machine123',
	})
	id: string;

	@ApiPropertyOptional({
		description: 'Organization that owns this machine',
		format: 'uuid',
	})
	organizationId?: string;

	@ApiPropertyOptional({
		description: 'Registered Ed25519 machine identity key ID',
	})
	identityKeyId?: string;

	@ApiProperty({
		description: 'The CPU capacity of the machine',
		example: 8,
	})
	cpu: number;

	@ApiProperty({
		description: 'The memory capacity of the machine in GiB',
		example: 16,
	})
	memory: number;

	@ApiProperty({
		description: 'The disk capacity of the machine in GiB',
		example: 100,
	})
	disk: number;

	@ApiPropertyOptional({
		description: 'The sandbox class supported by this machine',
		enum: SandboxClass,
		enumName: 'SandboxClass',
		example: SandboxClass.LINUX_VM,
	})
	@IsEnum(SandboxClass)
	sandboxClass?: SandboxClass;

	@ApiPropertyOptional({
		description: 'Current CPU usage percentage',
		example: 45.6,
	})
	currentCpuUsagePercentage: number;

	@ApiPropertyOptional({
		description: 'Current RAM usage percentage',
		example: 68.2,
	})
	currentMemoryUsagePercentage: number;

	@ApiPropertyOptional({
		description: 'Current disk usage percentage',
		example: 33.8,
	})
	currentDiskUsagePercentage: number;

	@ApiPropertyOptional({
		description: 'Current allocated CPU',
		example: 4000,
	})
	currentAllocatedCpu: number;

	@ApiPropertyOptional({
		description: 'Current allocated memory in GiB',
		example: 8000,
	})
	currentAllocatedMemoryGiB: number;

	@ApiPropertyOptional({
		description: 'Current allocated disk in GiB',
		example: 50000,
	})
	currentAllocatedDiskGiB: number;

	@ApiPropertyOptional({
		description: 'Current snapshot count',
		example: 12,
	})
	currentSnapshotCount: number;

	@ApiPropertyOptional({
		description: 'Current number of started sandboxes',
		example: 5,
	})
	currentStartedSandboxes: number;

	@ApiProperty({
		description:
			'Where the machine is, from IP geolocation of its connections; null until it is known',
		type: LocationDto,
		nullable: true,
	})
	location: LocationDto | null;

	@ApiProperty({
		description: 'The name of the machine',
		example: 'machine1',
	})
	name: string;

	@ApiProperty({
		description: 'The state of the machine',
		enum: MachineState,
		enumName: 'MachineState',
		example: MachineState.INITIALIZING,
	})
	@IsEnum(MachineState)
	state: MachineState;

	@ApiPropertyOptional({
		description: 'Host-safe explanation for a failed readiness transition',
	})
	readinessReason?: string;

	@ApiPropertyOptional({
		description: 'The last time the machine was checked',
		example: '2024-10-01T12:00:00Z',
		required: false,
	})
	@IsOptional()
	lastChecked?: string;

	@ApiProperty({
		description: 'Whether the machine is unschedulable',
		example: false,
	})
	unschedulable: boolean;

	@ApiProperty({
		description: 'Whether the machine is draining existing workloads',
		example: false,
	})
	draining: boolean;

	@ApiPropertyOptional({
		description: 'Health reported by services required by the machine',
		type: [MachineServiceHealthDto],
	})
	@IsOptional()
	serviceHealth?: MachineServiceHealthDto[];

	@ApiPropertyOptional({
		description: 'MicroVM machine, artifact, and runtime feature capabilities',
		type: MachineRuntimeCapabilitiesDto,
	})
	@IsOptional()
	runtimeCapabilities?: MachineRuntimeCapabilitiesDto;

	@ApiPropertyOptional({
		description: 'Last update transaction state reported by this machine',
		type: MachineUpdateStatusDto,
	})
	@IsOptional()
	updateStatus?: MachineUpdateStatusDto;

	@ApiProperty({
		description: 'The creation timestamp of the machine',
		example: '2023-10-01T12:00:00Z',
	})
	createdAt: string;

	@ApiProperty({
		description: 'The last update timestamp of the machine',
		example: '2023-10-01T12:00:00Z',
	})
	updatedAt: string;

	@ApiProperty({
		description: 'The machine control-plane protocol version',
		example: '0',
	})
	apiVersion: string;

	@ApiPropertyOptional({
		description: 'The machine release version',
		example: 'v0.0.0-dev',
	})
	@IsOptional()
	appVersion?: string;

	static from(machine: Machine): MachineDto {
		return {
			id: machine.id,
			organizationId: machine.organizationId ?? undefined,
			identityKeyId: machine.identityKeyId ?? undefined,
			cpu: machine.cpu,
			memory: machine.memoryGiB,
			disk: machine.diskGiB,
			sandboxClass: machine.sandboxClass,
			currentCpuUsagePercentage: machine.currentCpuUsagePercentage,
			currentMemoryUsagePercentage: machine.currentMemoryUsagePercentage,
			currentDiskUsagePercentage: machine.currentDiskUsagePercentage,
			currentAllocatedCpu: machine.currentAllocatedCpu,
			currentAllocatedMemoryGiB: machine.currentAllocatedMemoryGiB,
			currentAllocatedDiskGiB: machine.currentAllocatedDiskGiB,
			currentSnapshotCount: machine.currentSnapshotCount,
			currentStartedSandboxes: machine.currentStartedSandboxes,
			location: LocationDto.from(machine),
			name: machine.name,
			state: machine.state,
			readinessReason: machine.readinessReason ?? undefined,
			lastChecked: machine.lastChecked?.toISOString(),
			unschedulable: machine.unschedulable,
			draining: machine.draining,
			serviceHealth: machine.serviceHealth ?? undefined,
			runtimeCapabilities: machine.runtimeCapabilities ?? undefined,
			updateStatus: machine.updateStatus ?? undefined,
			createdAt: machine.createdAt.toISOString(),
			updatedAt: machine.updatedAt.toISOString(),
			apiVersion: machine.apiVersion,
			appVersion: machine.appVersion ?? undefined,
		};
	}
}

@ApiSchema({ name: 'MachineListQuery' })
export class MachineListQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({
		description:
			'Only machines in this continent (e.g. europe) or ISO 3166-1 alpha-2 country (e.g. DE)',
	})
	@IsOptional()
	@IsLocationCode()
	location?: string;
}

@ApiSchema({ name: 'MachinePage' })
export class MachinePageDto extends CursorPageDto<MachineDto> {
	@ApiProperty({ type: MachineDto, isArray: true })
	declare items: MachineDto[];
}
