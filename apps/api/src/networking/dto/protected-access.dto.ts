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
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
} from 'class-validator';
import { PROTECTED_ACCESS } from '../constants/protected-access.constants';

export class CreateProtectedAccessGrantDto {
	@ApiPropertyOptional({
		type: 'integer',
		format: 'int32',
		description:
			'Idle lifetime of the access session. The session slides by this much while it carries requests, up to a fixed absolute lifetime.',
		minimum: PROTECTED_ACCESS.minimumSessionLifetimeSeconds,
		maximum: PROTECTED_ACCESS.maximumSessionLifetimeSeconds,
		default: PROTECTED_ACCESS.defaultSessionLifetimeSeconds,
	})
	@IsOptional()
	@IsInt()
	@Min(PROTECTED_ACCESS.minimumSessionLifetimeSeconds)
	@Max(PROTECTED_ACCESS.maximumSessionLifetimeSeconds)
	sessionLifetimeSeconds?: number;
}

export class ProtectedAccessGrantDto {
	@ApiProperty()
	token: string;

	@ApiProperty({ format: 'uuid' })
	backendId: string;

	@ApiProperty({ format: 'date-time' })
	expiresAt: string;

	@ApiProperty({ format: 'date-time' })
	sessionExpiresAt: string;

	@ApiProperty({ format: 'uri' })
	url: string;
}

export class RedeemProtectedAccessGrantDto {
	@ApiProperty()
	@IsString()
	@MaxLength(PROTECTED_ACCESS.maximumGrantLength)
	token: string;

	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	backendId: string;
}

export class ProtectedAccessGrantRedemptionDto {
	@ApiProperty({ format: 'uuid' })
	backendId: string;

	@ApiProperty()
	sandboxId: string;

	@ApiProperty({ format: 'uuid' })
	exposureId: string;

	@ApiProperty()
	exposureName: string;

	@ApiProperty({ type: 'integer', format: 'int32' })
	targetPort: number;

	@ApiProperty()
	interactive: boolean;

	@ApiProperty({
		format: 'uuid',
		description:
			'Session the Edge reports while it carries requests, so the control plane can renew or revoke it',
	})
	sessionId: string;

	@ApiProperty({
		format: 'date-time',
		description:
			'Current idle expiry; renewed while the session is in use and authorized',
	})
	expiresAt: string;

	@ApiProperty({
		format: 'date-time',
		description: 'Hard expiry the session can never be renewed beyond',
	})
	absoluteExpiresAt: string;
}
