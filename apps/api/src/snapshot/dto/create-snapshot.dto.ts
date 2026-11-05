/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsEnum,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	Max,
	Min,
} from 'class-validator';
import { IsSafeDisplayString } from '../../common/validators/is-safe-string.validator';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { CreateBuildInfoDto } from './create-build-info.dto';

function gpuTypeList(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.length === 0 ? undefined : value;
	}
	if (value === undefined || value === null) {
		return value;
	}
	return [value];
}

@ApiSchema({ name: 'CreateSnapshot' })
export class CreateSnapshotDto {
	@ApiProperty({
		description: 'The name of the snapshot',
		example: 'ubuntu-4vcpu-8ram-100gb',
	})
	@IsString()
	@IsSafeDisplayString()
	name: string;

	@ApiPropertyOptional({
		description: 'The image name of the snapshot',
		example: 'ubuntu:24.04',
	})
	@IsOptional()
	@IsString()
	imageName?: string;

	@ApiPropertyOptional({
		description: 'The entrypoint command for the snapshot',
		example: 'sleep infinity',
	})
	@IsString({
		each: true,
	})
	@IsArray()
	@IsOptional()
	entrypoint?: string[];

	@ApiPropertyOptional({
		description: 'CPU cores allocated to the resulting sandbox',
		example: 1,
		type: 'integer',
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	cpu?: number;

	@ApiPropertyOptional({
		description: 'GPU units allocated to the resulting sandbox',
		example: 0,
		type: 'integer',
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(1)
	gpu?: number;

	@ApiPropertyOptional({
		description: 'Preferred GPU type for the resulting sandbox.',
		enum: GpuType,
		enumName: 'GpuType',
		isArray: true,
		example: [GpuType.H100],
	})
	@IsOptional()
	@Transform(({ value }) => gpuTypeList(value))
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(1)
	@IsEnum(GpuType, { each: true })
	gpuType?: GpuType[];

	@ApiPropertyOptional({
		description: 'Memory allocated to the resulting sandbox in GB',
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
		description: 'Build information for the snapshot',
		type: CreateBuildInfoDto,
	})
	@IsOptional()
	@IsObject()
	buildInfo?: CreateBuildInfoDto;

	@ApiPropertyOptional({
		description:
			'Target sandbox class. Determines which machines can run sandboxes created from this snapshot.',
		enum: SandboxClass,
		enumName: 'SandboxClass',
		example: SandboxClass.LINUX_VM,
	})
	@IsOptional()
	@IsEnum(SandboxClass)
	sandboxClass?: SandboxClass;
}
