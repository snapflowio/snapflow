/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsISO8601,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';
import { IsSafeDisplayString } from '../../../common/validators/is-safe-string.validator';
import {
	MACHINE_NAME_MAX_LENGTH,
	MACHINE_NAME_MIN_LENGTH,
} from '../constants/machine-name-regex.constants';
import {
	MACHINE_IDENTITY_PUBLIC_KEY_MAX_LENGTH,
	MACHINE_REGISTRATION_APP_VERSION_MAX_LENGTH,
} from '../constants/machine-registration.constants';

export class RegisterMachineDto {
	@ApiProperty({ example: 'garage-4090' })
	@IsString()
	@IsSafeDisplayString()
	@MinLength(MACHINE_NAME_MIN_LENGTH)
	@MaxLength(MACHINE_NAME_MAX_LENGTH)
	name: string;

	@ApiProperty({ description: 'PEM-encoded Ed25519 public identity key' })
	@IsString()
	@MaxLength(MACHINE_IDENTITY_PUBLIC_KEY_MAX_LENGTH)
	identityPublicKey: string;

	@ApiProperty({
		format: 'date-time',
		description: 'Time the identity proof was signed',
	})
	@IsISO8601({ strict: true })
	issuedAt: string;

	@ApiProperty({ description: 'Unpadded base64url nonce' })
	@IsString()
	nonce: string;

	@ApiProperty({
		description:
			'Unpadded base64url Ed25519 signature proving possession of the identity key',
	})
	@IsString()
	signature: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(MACHINE_REGISTRATION_APP_VERSION_MAX_LENGTH)
	appVersion?: string;
}

export class MachineRegistrationDto {
	@ApiProperty({ format: 'uuid' })
	machineId: string;

	@ApiProperty({ format: 'uuid' })
	ownerId: string;
}
