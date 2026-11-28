/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	IsBoolean,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import { API_KEY_NAME_MAX_LENGTH } from '../../auth/constants/api-key.constants';
import { MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS } from '../../auth/constants/machine-enrollment-key.constants';
import type { ApiKey } from '../../auth/entities/api-key.entity';
import {
	apiKeyCreator,
	apiKeySingleUse,
} from '../../auth/utils/api-key-metadata.util';
import { IsSafeDisplayString } from '../../common/validators/is-safe-string.validator';
import { MACHINE_ENROLLMENT_KEY_NAME_MIN_LENGTH } from '../constants/machine-enrollment.constants';

const NULLABLE_DATE = {
	type: String,
	format: 'date-time',
	nullable: true,
} as const;

@ApiSchema({ name: 'CreateMachineEnrollmentKey' })
export class CreateMachineEnrollmentKeyDto {
	@ApiProperty({ example: 'rack-a' })
	@IsString()
	@IsSafeDisplayString()
	@MinLength(MACHINE_ENROLLMENT_KEY_NAME_MIN_LENGTH)
	@MaxLength(API_KEY_NAME_MAX_LENGTH)
	name: string;

	@ApiPropertyOptional({
		default: true,
		description:
			'True for a key that enrolls one machine; false for a fleet key that enrolls any number until it expires',
	})
	@IsOptional()
	@IsBoolean()
	singleUse?: boolean;

	@ApiPropertyOptional({
		description: `Lifetime in seconds; defaults to ${MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS.SINGLE_USE_DEFAULT} for a single-use key and ${MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS.REUSABLE_DEFAULT} for a fleet key, at most ${MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS.SINGLE_USE_MAXIMUM} and ${MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS.REUSABLE_MAXIMUM}`,
		minimum: MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS.MINIMUM,
		maximum: MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS.REUSABLE_MAXIMUM,
	})
	@IsOptional()
	@IsInt()
	@Min(MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS.MINIMUM)
	@Max(MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS.REUSABLE_MAXIMUM)
	expiresIn?: number;
}

@ApiSchema({ name: 'MachineEnrollmentKey' })
export class MachineEnrollmentKeyDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ type: String, nullable: true })
	name: string | null;

	@ApiProperty({
		type: String,
		nullable: true,
		description: 'First characters of the key, for display',
	})
	start: string | null;

	@ApiProperty()
	singleUse: boolean;

	@ApiProperty({
		description:
			'False once a single-use key enrolled its machine or the key was disabled',
	})
	enabled: boolean;

	@ApiProperty(NULLABLE_DATE)
	expiresAt: Date | null;

	@ApiProperty({
		...NULLABLE_DATE,
		description: 'When the key last enrolled a machine',
	})
	lastUsedAt: Date | null;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	createdByUserId: string | null;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: Date;

	@ApiProperty({
		type: 'integer',
		minimum: 0,
		description:
			'How many machines this key enrolled; a machine enrolled again with another key counts for that key',
	})
	machineCount: number;

	static from(key: ApiKey, machineCount: number): MachineEnrollmentKeyDto {
		return {
			id: key.id,
			name: key.name,
			start: key.start,
			singleUse: apiKeySingleUse(key.metadata),
			enabled: key.enabled !== false,
			expiresAt: key.expiresAt,
			lastUsedAt: key.lastRequest,
			createdByUserId: apiKeyCreator(key.metadata),
			createdAt: key.createdAt,
			machineCount,
		};
	}
}

@ApiSchema({ name: 'CreatedMachineEnrollmentKey' })
export class CreatedMachineEnrollmentKeyDto extends MachineEnrollmentKeyDto {
	@ApiProperty({
		description: 'The secret key; it is shown only in this response',
	})
	key: string;

	@ApiProperty({
		description:
			'The command that installs the host agent on a machine and enrolls it with this key',
		example:
			'curl -fsSL https://snapflow.io/install.sh | sh -s snapflow_enroll_...',
	})
	installCommand: string;
}

@ApiSchema({ name: 'MachineEnrollmentKeyList' })
export class MachineEnrollmentKeyListDto {
	@ApiProperty({ type: MachineEnrollmentKeyDto, isArray: true })
	items: MachineEnrollmentKeyDto[];
}
