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
	IsNotEmpty,
	IsOptional,
	IsString,
	Min,
	ValidateNested,
} from 'class-validator';
import { SandboxCapability } from '../../sandbox/enums/sandbox-capability.enum';
import { MachineHypervisor } from '../enums/machine-hypervisor.enum';
import { MachineRuntimeFeature } from '../enums/machine-runtime-feature.enum';
import type {
	MachinePlatformArtifact,
	MachineRuntimeCapabilities,
} from '../types/machine-runtime.types';

@ApiSchema({ name: 'MachinePlatformArtifact' })
export class MachinePlatformArtifactDto implements MachinePlatformArtifact {
	@ApiProperty({
		description: 'Release child name, such as core or desktop-extension',
	})
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Immutable OCI digest of the resolved release child',
	})
	@IsString()
	digest: string;

	@ApiProperty({ description: 'Resolved guest platform, such as linux/amd64' })
	@IsString()
	platform: string;

	@ApiProperty({
		description: 'Guest capabilities supplied by the bundle',
		enum: SandboxCapability,
		enumName: 'SandboxCapability',
		isArray: true,
	})
	@IsArray()
	@IsEnum(SandboxCapability, { each: true })
	capabilities: SandboxCapability[];

	@ApiProperty({
		description: 'Guest control protocol implemented by this child',
	})
	@IsInt()
	@Min(1)
	protocolVersion: number;
}

@ApiSchema({ name: 'MachineRuntimeCapabilities' })
export class MachineRuntimeCapabilitiesDto
	implements MachineRuntimeCapabilities
{
	@ApiProperty()
	@IsBoolean()
	kvmAvailable: boolean;

	@ApiProperty()
	@IsBoolean()
	cgroupV2Available: boolean;

	@ApiProperty()
	@IsBoolean()
	firecrackerSnapshotAvailable: boolean;

	@ApiProperty({
		description:
			'The machine filesystem supports bounded-latency copy-on-write Firecracker template cloning',
	})
	@IsBoolean()
	firecrackerTemplateAvailable: boolean;

	@ApiProperty({
		enum: MachineHypervisor,
		enumName: 'MachineHypervisor',
		isArray: true,
	})
	@IsArray()
	@IsEnum(MachineHypervisor, { each: true })
	hypervisors: MachineHypervisor[];

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	firecrackerVersion?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	cloudHypervisorVersion?: string;

	@ApiProperty()
	@IsString()
	machineReleaseVersion: string;

	@ApiProperty({
		description: 'SHA-256 identity of the TUF-authorized Snapflow release',
	})
	@IsString()
	machineReleaseDigest: string;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 1 })
	@IsInt()
	@Min(1)
	controlProtocolVersion: number;

	@ApiProperty({ description: 'Verified SHA-256 identity of snapflowd' })
	@IsString()
	machineIdentity: string;

	@ApiProperty({ description: 'Verified SHA-256 identity of Firecracker' })
	@IsString()
	firecrackerIdentity: string;

	@ApiProperty({ description: 'Verified SHA-256 identity of Cloud Hypervisor' })
	@IsString()
	cloudHypervisorIdentity: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	kernelIdentity?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	initrdIdentity?: string;

	@ApiProperty({ type: [String] })
	@IsArray()
	@IsString({ each: true })
	guestPlatforms: string[];

	@ApiProperty({ type: [String] })
	@IsArray()
	@IsString({ each: true })
	preparedImageDigests: string[];

	@ApiProperty({ type: [String] })
	@IsArray()
	@IsString({ each: true })
	preparedTemplateKeys: string[];

	@ApiPropertyOptional({
		description: 'Pinned digest of the atomic guest-platform release index',
	})
	@IsOptional()
	@IsString()
	guestReleaseDigest?: string;

	@ApiProperty({ type: [MachinePlatformArtifactDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => MachinePlatformArtifactDto)
	platformArtifacts: MachinePlatformArtifactDto[];

	@ApiProperty({
		enum: MachineRuntimeFeature,
		enumName: 'MachineRuntimeFeature',
		isArray: true,
	})
	@IsArray()
	@IsEnum(MachineRuntimeFeature, { each: true })
	features: MachineRuntimeFeature[];

	@ApiProperty({
		description:
			'Image the machine builds snapshots with; the API pre-warms it on the machine',
	})
	@IsString()
	@IsNotEmpty()
	builderImage: string;
}
