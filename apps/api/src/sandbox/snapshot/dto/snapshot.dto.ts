/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SandboxClass } from '../../enums/sandbox-class.enum';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { BuildInfoDto } from './build-info.dto';

export class SnapshotDto {
	@ApiProperty()
	id: string;

	@ApiPropertyOptional()
	organizationId?: string;

	@ApiProperty()
	general: boolean;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	imageName?: string;

	@ApiProperty({
		enum: SnapshotState,
		enumName: 'SnapshotState',
	})
	state: SnapshotState;

	@ApiProperty({ type: Number, nullable: true })
	size: number | null;

	@ApiProperty({ type: [String], nullable: true })
	entrypoint: string[] | null;

	@ApiProperty()
	cpu: number;

	@ApiProperty()
	gpu: number;

	@ApiPropertyOptional({
		description: 'The GPU type assigned to the snapshot',
		enum: GpuType,
		enumName: 'GpuType',
		example: GpuType.H100,
	})
	@IsEnum(GpuType)
	@IsOptional()
	gpuType?: GpuType;

	@ApiProperty()
	mem: number;

	@ApiProperty()
	disk: number;

	@ApiProperty({ type: String, nullable: true })
	errorReason: string | null;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	updatedAt: Date;

	@ApiProperty({ type: Date, nullable: true })
	lastUsedAt: Date | null;

	@ApiPropertyOptional({
		description: 'Build information for the snapshot',
		type: BuildInfoDto,
	})
	buildInfo?: BuildInfoDto;

	@ApiPropertyOptional({
		description: 'The initial machine ID of the snapshot',
		example: 'machine123',
		required: false,
	})
	@IsOptional()
	initialMachineId?: string;

	@ApiPropertyOptional({
		description: 'The snapshot reference',
		example: 'snapflowio/sandbox:latest',
		required: false,
	})
	@IsOptional()
	ref?: string;

	@ApiPropertyOptional({
		description: 'The sandbox class of the snapshot',
		enum: SandboxClass,
		enumName: 'SandboxClass',
		example: SandboxClass.LINUX_VM,
		required: false,
	})
	@IsEnum(SandboxClass)
	@IsOptional()
	sandboxClass?: SandboxClass;

	static from(snapshot: Snapshot): SnapshotDto {
		return {
			id: snapshot.id,
			organizationId: snapshot.organizationId ?? undefined,
			general: snapshot.general,
			name: snapshot.name,
			imageName: snapshot.imageName,
			state: snapshot.state,
			size: snapshot.size ?? null,
			entrypoint: snapshot.entrypoint ?? null,
			cpu: snapshot.cpu,
			gpu: snapshot.gpu,
			gpuType: snapshot.gpuType ?? undefined,
			mem: snapshot.mem,
			disk: snapshot.disk,
			errorReason: snapshot.errorReason ?? null,
			createdAt: snapshot.createdAt,
			updatedAt: snapshot.updatedAt,
			lastUsedAt: snapshot.lastUsedAt ?? null,
			buildInfo: snapshot.buildInfo
				? {
						dockerfileContent:
							snapshot.buildInfo.dockerfileContent ?? undefined,
						contextHashes: snapshot.buildInfo.contextHashes ?? undefined,
						createdAt: snapshot.buildInfo.createdAt,
						updatedAt: snapshot.buildInfo.updatedAt,
						snapshotRef: snapshot.buildInfo.snapshotRef,
					}
				: undefined,
			initialMachineId: snapshot.initialMachineId ?? undefined,
			ref: snapshot.ref ?? undefined,
			sandboxClass: snapshot.sandboxClass,
		};
	}
}
