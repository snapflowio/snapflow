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
	IsInt,
	IsString,
	IsUUID,
	Matches,
	MaxLength,
	Min,
} from 'class-validator';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const CERTIFICATE_REQUEST_PATTERN =
	/^-----BEGIN CERTIFICATE REQUEST-----\r?\n(?:[A-Za-z0-9+/]{1,64}={0,2}\r?\n)+-----END CERTIFICATE REQUEST-----\r?\n?$/;
const MAXIMUM_CERTIFICATE_REQUEST_LENGTH = 16_384;

export class IssueMachineTunnelCertificateDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	edgeId: string;

	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	bindingId: string;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 1 })
	@IsInt()
	@Min(1)
	bindingRevision: number;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	@Matches(SHA256_HEX_PATTERN)
	bindingDigest: string;

	@ApiProperty({
		description: 'PEM-encoded PKCS#10 request using an ephemeral Ed25519 key',
	})
	@IsString()
	@MaxLength(MAXIMUM_CERTIFICATE_REQUEST_LENGTH)
	@Matches(CERTIFICATE_REQUEST_PATTERN)
	csr: string;
}

export class MachineTunnelCertificateDto {
	@ApiProperty()
	certificateChain: string;

	@ApiProperty({ format: 'date-time' })
	expiresAt: string;

	@ApiProperty()
	spiffeId: string;
}
