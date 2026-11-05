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
	IsEnum,
	IsInt,
	IsNumber,
	IsUUID,
	Matches,
	Max,
	Min,
} from 'class-validator';
import {
	TUNNEL_CARRIER,
	type TunnelCarrier,
} from '../constants/machine-tunnel.constants';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export class MachineTunnelBindingAcknowledgementDto {
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

	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	connectionId: string;

	@ApiProperty({ enum: TUNNEL_CARRIER, enumName: 'TunnelCarrier' })
	@IsEnum(TUNNEL_CARRIER)
	carrier: TunnelCarrier;

	@ApiProperty({ minimum: 0 })
	@IsNumber()
	@Min(0)
	smoothedRttMilliseconds: number;

	@ApiProperty({ minimum: 0, maximum: 1 })
	@IsNumber()
	@Min(0)
	@Max(1)
	lossRatio: number;
}

export class MachineTunnelBindingAcknowledgementResponseDto {
	@ApiProperty({ format: 'uuid' })
	bindingId: string;

	@ApiProperty({ format: 'uuid' })
	connectionId: string;

	@ApiProperty({ format: 'date-time' })
	acceptedAt: string;
}

export class MachineTunnelTargetPlanAcknowledgementDto {
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

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 1 })
	@IsInt()
	@Min(1)
	targetRevision: number;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	@Matches(SHA256_HEX_PATTERN)
	targetDigest: string;
}

export class MachineTunnelTargetPlanAcknowledgementResponseDto {
	@ApiProperty({ format: 'uuid' })
	bindingId: string;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 1 })
	targetRevision: number;

	@ApiProperty({ format: 'date-time' })
	acceptedAt: string;
}
