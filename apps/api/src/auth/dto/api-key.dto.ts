/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CredentialPermissions } from '@snapflow/organization-access';
import {
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import { IsSafeDisplayString } from '../../common/validators/is-safe-string.validator';
import {
	API_KEY_MAX_EXPIRATION_DAYS,
	API_KEY_MIN_EXPIRATION_DAYS,
	API_KEY_NAME_MAX_LENGTH,
} from '../constants/api-key.constants';
import { IsCredentialPermissions } from '../validators/is-credential-permissions.validator';

const SECONDS_PER_DAY = 24 * 60 * 60;
const API_KEY_NAME_MIN_LENGTH = 1;

const API_KEY_PERMISSIONS_SCHEMA = {
	type: 'object',
	additionalProperties: { type: 'array', items: { type: 'string' } },
	example: { sandboxes: ['write'], snapshots: ['write', 'delete'] },
} as const;

export class CreateApiKeyDto {
	@ApiProperty({ example: 'ci-deploy' })
	@IsString()
	@IsSafeDisplayString()
	@MinLength(API_KEY_NAME_MIN_LENGTH)
	@MaxLength(API_KEY_NAME_MAX_LENGTH)
	name: string;

	@ApiPropertyOptional({
		description: 'Lifetime in seconds; omit for a key that does not expire',
		minimum: API_KEY_MIN_EXPIRATION_DAYS * SECONDS_PER_DAY,
		maximum: API_KEY_MAX_EXPIRATION_DAYS * SECONDS_PER_DAY,
	})
	@IsOptional()
	@IsInt()
	@Min(API_KEY_MIN_EXPIRATION_DAYS * SECONDS_PER_DAY)
	@Max(API_KEY_MAX_EXPIRATION_DAYS * SECONDS_PER_DAY)
	expiresIn?: number;

	@ApiProperty({
		...API_KEY_PERMISSIONS_SCHEMA,
		description: 'Actions granted per resource',
	})
	@IsCredentialPermissions()
	permissions: CredentialPermissions;
}

export class CreatedApiKeyDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ format: 'uuid', description: 'Organization the key acts for' })
	organizationId: string;

	@ApiProperty({ nullable: true, type: String })
	name: string | null;

	@ApiProperty({
		description: 'The secret key; it is shown only in this response',
	})
	key: string;

	@ApiProperty({
		description: 'First characters of the key, for display',
		nullable: true,
		type: String,
	})
	start: string | null;

	@ApiProperty({
		...API_KEY_PERMISSIONS_SCHEMA,
		description: 'Actions granted per resource',
	})
	permissions: CredentialPermissions;

	@ApiProperty({ format: 'date-time', nullable: true, type: String })
	expiresAt: string | null;

	@ApiProperty({ format: 'date-time' })
	createdAt: string;
}
