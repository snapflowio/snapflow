/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { MACHINE_AUTHORIZATION_SCHEME } from '../constants/machine-session.constants';

export class CreateMachineSessionDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	machineId: string;
}

export class MachineSessionDto {
	@ApiProperty({ format: 'uuid' })
	sessionId: string;

	@ApiProperty({ enum: [MACHINE_AUTHORIZATION_SCHEME] })
	tokenType: typeof MACHINE_AUTHORIZATION_SCHEME;

	@ApiProperty({
		description:
			'Short-lived opaque token sender-constrained to the enrolled machine key',
	})
	token: string;

	@ApiProperty({ format: 'date-time' })
	expiresAt: string;

	@ApiProperty({ type: 'integer', format: 'int32' })
	generation: number;
}

export class RenewMachineSessionDto {
	@ApiProperty({ format: 'date-time' })
	expiresAt: string;
}
