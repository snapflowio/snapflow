/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import { Volume } from '../entities/volume.entity';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';
import { VolumeState } from '../enums/volume-state.enum';

export class VolumeDto {
	@ApiProperty({
		description: 'Volume ID',
		example: 'vol-12345678',
	})
	id: string;

	@ApiProperty({
		description: 'Volume name',
		example: 'my-volume',
	})
	name: string;

	@ApiProperty({ description: 'Persistent block volume size in GiB' })
	sizeGiB: number;

	@ApiProperty({
		description: 'Filesystem stored on the volume',
		example: 'ext4',
	})
	filesystem: string;

	@ApiProperty({ description: 'Current durable data generation' })
	generation: number;

	@ApiPropertyOptional({
		description: 'Latest completed portable backup artifact ID',
	})
	backupArtifactId?: string;

	@ApiPropertyOptional({
		description: 'Latest completed portable backup generation',
	})
	backupGeneration?: number;

	@ApiProperty({
		description: 'Portable volume backup state',
		enum: VolumeBackupState,
		enumName: 'VolumeBackupState',
	})
	backupState: VolumeBackupState;

	@ApiPropertyOptional({
		description: 'Latest successful portable backup timestamp',
	})
	lastBackupAt?: string;

	@ApiProperty({
		description: 'Owner organization ID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	organizationId: string | null;

	@ApiProperty({
		description: 'Volume state',
		enum: VolumeState,
		enumName: 'VolumeState',
		example: VolumeState.READY,
	})
	@IsEnum(VolumeState)
	state: VolumeState;

	@ApiProperty({
		description: 'Creation timestamp',
		example: '2023-01-01T00:00:00.000Z',
	})
	createdAt: string;

	@ApiProperty({
		description: 'Last update timestamp',
		example: '2023-01-01T00:00:00.000Z',
	})
	updatedAt: string;

	@ApiPropertyOptional({
		description: 'Last used timestamp',
		example: '2023-01-01T00:00:00.000Z',
		nullable: true,
	})
	lastUsedAt?: string;

	@ApiProperty({
		description: 'The error reason of the volume',
		example: 'Error processing volume',
		nullable: true,
	})
	errorReason?: string;

	static from(volume: Volume): VolumeDto {
		return {
			id: volume.id,
			name: volume.name,
			sizeGiB: volume.sizeGiB,
			filesystem: volume.filesystem,
			generation: volume.generation,
			backupArtifactId: volume.backupArtifactId ?? undefined,
			backupGeneration: volume.backupGeneration ?? undefined,
			backupState: volume.backupState,
			lastBackupAt: volume.lastBackupAt?.toISOString(),
			organizationId: volume.organizationId,
			state: volume.state,
			createdAt: volume.createdAt?.toISOString(),
			updatedAt: volume.updatedAt?.toISOString(),
			lastUsedAt: volume.lastUsedAt?.toISOString(),
			errorReason: volume.errorReason ?? undefined,
		};
	}
}

export class ListVolumesQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({
		description: 'Include deleted volumes in the response',
		default: false,
	})
	@IsOptional()
	@Transform(({ value }) => value === true || value === 'true')
	@IsBoolean()
	includeDeleted = false;
}

export class VolumePageDto extends CursorPageDto<VolumeDto> {
	@ApiProperty({ type: VolumeDto, isArray: true })
	declare items: VolumeDto[];
}
