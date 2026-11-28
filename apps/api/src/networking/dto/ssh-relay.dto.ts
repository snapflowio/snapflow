/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MACHINE_SSH_HOST_PUBLIC_KEY_MAX_LENGTH } from '../../machine/constants/machine.constants';
import { NETWORKING_LIMITS } from '../constants/networking.constants';

const SSH_ACCESS_TOKEN_MAX_LENGTH = 128;

export class ResolveSshRelayDto {
	@ApiProperty()
	@IsString()
	@MinLength(1)
	@MaxLength(SSH_ACCESS_TOKEN_MAX_LENGTH)
	token: string;
}

export class SshRelayDto {
	@ApiProperty()
	sandboxId: string;

	@ApiProperty({ format: 'uuid' })
	machineId: string;

	@ApiProperty({ maxLength: NETWORKING_LIMITS.maximumHostnameLength })
	host: string;

	@ApiProperty({ type: 'integer', minimum: 1, maximum: 65_535 })
	port: number;

	@ApiProperty({ maxLength: MACHINE_SSH_HOST_PUBLIC_KEY_MAX_LENGTH })
	machineHostPublicKey: string;

	@ApiProperty({ format: 'date-time' })
	expiresAt: string;
}

export class MachineSshAccessDto {
	@ApiProperty()
	sandboxId: string;
}
