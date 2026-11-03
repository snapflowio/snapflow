/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import {
	IsDateString,
	IsString,
	IsUUID,
	Matches,
	MaxLength,
} from 'class-validator';
import { SHA256_HEX_LENGTH } from '../../../common/constants/digest.constants';
import { EDGE_IDENTITY } from '../constants/edge.constants';
import { NETWORKING_LIMITS } from '../constants/networking.constants';

const MAXIMUM_IDENTITY_PUBLIC_KEY_LENGTH = 1_024;

const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const EDGE_KEY_ID_PATTERN = /^ed25519:[a-f0-9]{64}$/;

class EdgeIdentityProofDto {
	@ApiProperty({ format: 'date-time' })
	@IsDateString({ strict: true })
	issuedAt: string;

	@ApiProperty({ description: 'Unique unpadded base64url nonce' })
	@IsString()
	@Matches(BASE64_URL_PATTERN)
	nonce: string;

	@ApiProperty({ description: 'Unpadded base64url Ed25519 signature' })
	@IsString()
	@Matches(BASE64_URL_PATTERN)
	signature: string;
}

export class CompleteEdgeEnrollmentDto extends EdgeIdentityProofDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	edgeId: string;

	@ApiProperty({ description: 'One-time enrollment secret' })
	@IsString()
	enrollmentSecret: string;

	@ApiProperty({ description: 'PEM-encoded Ed25519 public identity key' })
	@IsString()
	@MaxLength(MAXIMUM_IDENTITY_PUBLIC_KEY_LENGTH)
	identityPublicKey: string;

	@ApiProperty({
		example: `${EDGE_IDENTITY.keyIdPrefix}${'0'.repeat(SHA256_HEX_LENGTH)}`,
	})
	@Matches(EDGE_KEY_ID_PATTERN)
	@MaxLength(NETWORKING_LIMITS.maximumIdentityKeyIdLength)
	identityKeyId: string;
}

export class EdgeEnrollmentDto {
	@ApiProperty({ format: 'uuid' })
	edgeId: string;

	@ApiProperty({ format: 'date-time' })
	enrolledAt: string;

	@ApiProperty({ type: 'integer', minimum: 1 })
	credentialGeneration: number;
}

export class CreateEdgeSessionDto extends EdgeIdentityProofDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	edgeId: string;
}

export class EdgeSessionDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ description: 'One-time bearer token for this Edge session' })
	token: string;

	@ApiProperty({ format: 'date-time' })
	expiresAt: string;

	@ApiProperty({ type: 'integer', minimum: 1 })
	generation: number;
}

export class RenewEdgeSessionDto {
	@ApiProperty({ format: 'date-time' })
	expiresAt: string;
}
