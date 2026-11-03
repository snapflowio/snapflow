/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsDateString,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import { EDGE_CONTROL_LIMITS } from '../constants/edge.constants';
import {
	NETWORK_PROTOCOL,
	NETWORKING_LIMITS,
	type NetworkProtocol,
} from '../constants/networking.constants';
import type { EdgeUsageCheckpoint } from '../entities/edge-usage-checkpoint.entity';

const NONNEGATIVE_BIGINT = /^(0|[1-9][0-9]{0,18})$/;
const POSITIVE_BIGINT = /^[1-9][0-9]{0,18}$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const BASE64_URL_SIGNATURE = /^[A-Za-z0-9_-]{86}$/;

export class EdgeUsageSampleDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	backendId: string;

	@ApiProperty({
		type: 'integer',
		format: 'int32',
		minimum: 1,
		maximum: NETWORKING_LIMITS.maximumBindingRevision,
	})
	@IsInt()
	@Min(1)
	@Max(NETWORKING_LIMITS.maximumBindingRevision)
	assignmentGeneration: number;

	@ApiProperty({ enum: NETWORK_PROTOCOL, enumName: 'NetworkProtocol' })
	@IsEnum(NETWORK_PROTOCOL)
	protocol: NetworkProtocol;

	@ApiProperty()
	@Matches(NONNEGATIVE_BIGINT)
	bytesIn: string;

	@ApiProperty()
	@Matches(NONNEGATIVE_BIGINT)
	bytesOut: string;

	@ApiProperty()
	@Matches(NONNEGATIVE_BIGINT)
	packetsIn: string;

	@ApiProperty()
	@Matches(NONNEGATIVE_BIGINT)
	packetsOut: string;

	@ApiProperty({
		description:
			'Connections accepted on a TCP route, or requests proxied on an HTTP route. For HTTP it bounds the per-request header bytes tolerated when Edge and machine byte counts are reconciled.',
		type: 'integer',
		format: 'int32',
		minimum: 0,
		maximum: NETWORKING_LIMITS.maximumBindingRevision,
	})
	@IsInt()
	@Min(0)
	@Max(NETWORKING_LIMITS.maximumBindingRevision)
	tcpConnections: number;

	@ApiProperty({
		description:
			'UDP flows opened on a UDP route. Retained in the signed checkpoint evidence; it is not a billing dimension.',
		type: 'integer',
		format: 'int32',
		minimum: 0,
		maximum: NETWORKING_LIMITS.maximumBindingRevision,
	})
	@IsInt()
	@Min(0)
	@Max(NETWORKING_LIMITS.maximumBindingRevision)
	udpFlows: number;
}

export class EdgeUsageCheckpointDto {
	@ApiProperty({
		description:
			'Usage epoch opened by the Edge through POST /edge/usage-epochs; the sequence restarts at 1 in each epoch',
		type: 'integer',
		format: 'int32',
		minimum: 1,
		maximum: NETWORKING_LIMITS.maximumBindingRevision,
	})
	@IsInt()
	@Min(1)
	@Max(NETWORKING_LIMITS.maximumBindingRevision)
	usageEpoch: number;

	@ApiProperty({
		description: 'Monotonic decimal uint64 sequence within the usage epoch',
	})
	@Matches(POSITIVE_BIGINT)
	sequence: string;

	@ApiPropertyOptional({ minLength: 64, maxLength: 64 })
	@IsOptional()
	@Matches(SHA256_HEX)
	previousDigest?: string;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	@Matches(SHA256_HEX)
	digest: string;

	@ApiProperty({
		type: 'integer',
		format: 'int32',
		minimum: 1,
		maximum: NETWORKING_LIMITS.maximumBindingRevision,
	})
	@IsInt()
	@Min(1)
	@Max(NETWORKING_LIMITS.maximumBindingRevision)
	edgeSessionGeneration: number;

	@ApiProperty({ format: 'date-time' })
	@IsDateString({ strict: true })
	intervalStartedAt: string;

	@ApiProperty({ format: 'date-time' })
	@IsDateString({ strict: true })
	intervalEndedAt: string;

	@ApiProperty({ type: [EdgeUsageSampleDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(EDGE_CONTROL_LIMITS.maximumUsageSamplesPerCheckpoint)
	@ValidateNested({ each: true })
	@Type(() => EdgeUsageSampleDto)
	samples: EdgeUsageSampleDto[];

	@ApiProperty({ description: 'Unpadded base64url Ed25519 signature' })
	@IsString()
	@Matches(BASE64_URL_SIGNATURE)
	signature: string;
}

export class EdgeUsageCheckpointAcknowledgementDto {
	@ApiProperty({ type: 'integer', format: 'int32' })
	usageEpoch: number;

	@ApiProperty()
	sequence: string;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	digest: string;

	static from(
		checkpoint: Pick<EdgeUsageCheckpoint, 'usageEpoch' | 'sequence' | 'digest'>
	): EdgeUsageCheckpointAcknowledgementDto {
		return {
			usageEpoch: checkpoint.usageEpoch,
			sequence: checkpoint.sequence,
			digest: checkpoint.digest,
		};
	}
}

export class EdgeUsageEpochDto {
	@ApiProperty({
		description:
			'Newly opened usage epoch; every earlier epoch of this Edge is closed',
		type: 'integer',
		format: 'int32',
		minimum: 1,
	})
	usageEpoch: number;

	@ApiPropertyOptional({
		description:
			'Digest of the last accepted checkpoint of this Edge; the first checkpoint of the epoch chains to it',
		minLength: 64,
		maxLength: 64,
	})
	previousDigest?: string;
}
