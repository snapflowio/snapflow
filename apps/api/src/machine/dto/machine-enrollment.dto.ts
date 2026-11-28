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
	IsEthereumAddress,
	IsISO8601,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from 'class-validator';
import type { Address, Hex } from 'viem';
import { IsSafeDisplayString } from '../../common/validators/is-safe-string.validator';
import { EVM_ADDRESS_API_PROPERTY } from '../../settlement/constants/settlement.constants';
import { MACHINE_ENROLLMENT_TOKEN_MAX_LENGTH } from '../constants/machine-enrollment.constants';
import {
	MACHINE_NAME_MAX_LENGTH,
	MACHINE_NAME_MIN_LENGTH,
} from '../constants/machine-name-regex.constants';
import {
	MACHINE_HOST_SIGNATURE_PATTERN,
	MACHINE_IDENTITY_PUBLIC_KEY_MAX_LENGTH,
	MACHINE_REGISTRATION_APP_VERSION_MAX_LENGTH,
} from '../constants/machine-registration.constants';

@ApiSchema({ name: 'MachineEnrollmentProof' })
export class MachineEnrollmentProofDto {
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
		...EVM_ADDRESS_API_PROPERTY,
		description:
			"Address of the machine's secp256k1 host key, the on-chain host of its payment channels",
	})
	@IsEthereumAddress()
	hostAddress: Address;

	@ApiProperty({
		format: 'date-time',
		description: 'Time the proof was signed, within five minutes of now',
	})
	@IsISO8601({ strict: true })
	issuedAt: string;

	@ApiProperty({ description: 'Unpadded base64url nonce of at least 16 bytes' })
	@IsString()
	nonce: string;

	@ApiProperty({
		description:
			'Unpadded base64url Ed25519 signature of the proof message by the identity key',
	})
	@IsString()
	identitySignature: string;

	@ApiProperty({
		type: String,
		description:
			'0x-prefixed 65-byte EIP-191 personal_sign signature of the proof message by the host key',
		pattern: MACHINE_HOST_SIGNATURE_PATTERN.source,
	})
	@Matches(MACHINE_HOST_SIGNATURE_PATTERN)
	hostSignature: Hex;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(MACHINE_REGISTRATION_APP_VERSION_MAX_LENGTH)
	appVersion?: string;
}

@ApiSchema({ name: 'EnrollMachine' })
export class EnrollMachineDto extends MachineEnrollmentProofDto {
	@ApiProperty({
		description:
			'The enrollment key from the dashboard; a single-use key is spent by the first enrollment',
	})
	@IsString()
	@MaxLength(MACHINE_ENROLLMENT_TOKEN_MAX_LENGTH)
	token: string;
}

@ApiSchema({ name: 'MachineEnrollment' })
export class MachineEnrollmentDto {
	@ApiProperty({ format: 'uuid' })
	machineId: string;

	@ApiProperty({
		format: 'uuid',
		description: 'Organization owning the machine',
	})
	organizationId: string;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The registered host key address',
	})
	hostAddress: Address;
}
