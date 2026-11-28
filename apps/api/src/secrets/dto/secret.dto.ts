/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import {
	SECRET_ENVIRONMENT_NAME_PATTERN,
	SECRET_LIMITS,
} from '../constants/secret.constants';
import type { Secret } from '../entities/secret.entity';
import type { SecretVersion } from '../entities/secret-version.entity';

export class CreateSecretDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(SECRET_LIMITS.NAME_MAX_LENGTH)
	name: string;
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(SECRET_LIMITS.DESCRIPTION_MAX_LENGTH)
	description?: string;
	@ApiProperty({ writeOnly: true })
	@IsString()
	@MaxLength(SECRET_LIMITS.VALUE_MAX_BYTES)
	value: string;
}

export class UpdateSecretDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(SECRET_LIMITS.NAME_MAX_LENGTH)
	name?: string;
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(SECRET_LIMITS.DESCRIPTION_MAX_LENGTH)
	description?: string;
}

export class CreateSecretVersionDto {
	@ApiProperty({ writeOnly: true })
	@IsString()
	@MaxLength(SECRET_LIMITS.VALUE_MAX_BYTES)
	value: string;
}

export class SecretBindingDto {
	@ApiProperty({ example: 'DATABASE_PASSWORD' })
	@IsString()
	@Matches(SECRET_ENVIRONMENT_NAME_PATTERN)
	@MaxLength(SECRET_LIMITS.ENVIRONMENT_NAME_MAX_LENGTH)
	name: string;
	@ApiProperty() @IsUUID() secretId: string;
	@ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) version?: number;
}

export class ReplaceSandboxSecretBindingsDto {
	@ApiProperty({ type: [SecretBindingDto] })
	@IsArray()
	@ArrayMaxSize(SECRET_LIMITS.BINDINGS_PER_SANDBOX)
	@ValidateNested({ each: true })
	@Type(() => SecretBindingDto)
	bindings: SecretBindingDto[];
}

export class SandboxSecretBindingMetadataDto extends SecretBindingDto {
	@ApiProperty() secretVersionId: string;
}

export class SandboxSecretBindingSetDto {
	@ApiProperty() sandboxId: string;
	@ApiProperty() resourceVersion: number;
	@ApiProperty({ type: [SandboxSecretBindingMetadataDto] })
	bindings: SandboxSecretBindingMetadataDto[];
}

export class SecretVersionDto {
	@ApiProperty() id: string;
	@ApiProperty() secretId: string;
	@ApiProperty() version: number;
	@ApiProperty() resourceVersion: number;
	@ApiProperty() createdAt: Date;
	@ApiProperty({ nullable: true }) revokedAt: Date | null;

	static from(entity: SecretVersion): SecretVersionDto {
		return {
			id: entity.id,
			secretId: entity.secretId,
			version: entity.version,
			resourceVersion: entity.resourceVersion,
			createdAt: entity.createdAt,
			revokedAt: entity.revokedAt,
		};
	}
}

export class SecretDto {
	@ApiProperty() id: string;
	@ApiProperty() organizationId: string;
	@ApiProperty() name: string;
	@ApiProperty({ type: String, nullable: true }) description: string | null;
	@ApiProperty() currentVersion: number;
	@ApiProperty() resourceVersion: number;
	@ApiProperty() createdAt: Date;
	@ApiProperty() updatedAt: Date;

	static from(entity: Secret): SecretDto {
		return {
			id: entity.id,
			organizationId: entity.organizationId,
			name: entity.name,
			description: entity.description,
			currentVersion: entity.currentVersion,
			resourceVersion: entity.resourceVersion,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt,
		};
	}
}

export class SecretPageDto extends CursorPageDto<SecretDto> {
	@ApiProperty({ type: SecretDto, isArray: true })
	declare items: SecretDto[];
}

export class SecretVersionPageDto extends CursorPageDto<SecretVersionDto> {
	@ApiProperty({ type: SecretVersionDto, isArray: true })
	declare items: SecretVersionDto[];
}
