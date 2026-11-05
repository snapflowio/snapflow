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
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import {
	EDGE_CONTROL_LIMITS,
	EDGE_STATUS,
	type EdgeStatus,
} from '../constants/edge.constants';
import {
	NETWORK_PROTOCOL,
	NETWORKING_LIMITS,
	type NetworkProtocol,
} from '../constants/networking.constants';
import { EdgeCapacityProfileDto } from './edge.dto';

const NONNEGATIVE_INTEGER_PATTERN = /^(0|[1-9][0-9]*)$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export class EdgeCapacitySnapshotDto extends EdgeCapacityProfileDto {
	@ApiProperty()
	@IsBoolean()
	placementEligible: boolean;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	routeCount: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	tunnelHeadroom: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	httpRequestHeadroom: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	httpConnectionHeadroom: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	httpStreamHeadroom: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	tcpConnectionHeadroom: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	udpFlowHeadroom: number;

	@ApiProperty({ minimum: 0, maximum: 1 })
	@IsNumber()
	@Min(0)
	@Max(1)
	cpuUtilization: number;

	@ApiProperty({ minimum: 0, maximum: 1 })
	@IsNumber()
	@Min(0)
	@Max(1)
	memoryUtilization: number;

	@ApiProperty({ type: 'integer', format: 'int64', minimum: 0 })
	@IsInt()
	@Min(0)
	packetDrops: number;

	@ApiProperty()
	@Matches(NONNEGATIVE_INTEGER_PATTERN)
	admissionRateRejections: string;

	@ApiProperty()
	@Matches(NONNEGATIVE_INTEGER_PATTERN)
	admissionCapacityRejections: string;

	@ApiProperty()
	@Matches(NONNEGATIVE_INTEGER_PATTERN)
	admissionDrainRejections: string;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	sourceAdmissionEntries: number;

	@ApiProperty()
	@Matches(NONNEGATIVE_INTEGER_PATTERN)
	sourceAdmissionEvictions: string;

	@ApiProperty()
	@Matches(NONNEGATIVE_INTEGER_PATTERN)
	datagramsDelivered: string;

	@ApiProperty()
	@Matches(NONNEGATIVE_INTEGER_PATTERN)
	datagramsDropped: string;

	@ApiProperty()
	@Matches(NONNEGATIVE_INTEGER_PATTERN)
	datagramsFailed: string;
}

export class EdgeBindingAcknowledgementDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	machineId: string;

	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	bindingId: string;

	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	connectionId: string;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@IsInt()
	@Min(1)
	bindingRevision: number;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	@Matches(SHA256_HEX_PATTERN)
	bindingDigest: string;
}

export class EdgeRouteListenerStatusDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	backendId: string;

	@ApiProperty({ enum: NETWORK_PROTOCOL, enumName: 'NetworkProtocol' })
	@IsEnum(NETWORK_PROTOCOL)
	protocol: NetworkProtocol;

	@ApiProperty({ type: 'integer', minimum: 1, maximum: 65_535 })
	@IsInt()
	@Min(NETWORKING_LIMITS.minimumPort)
	@Max(NETWORKING_LIMITS.maximumPort)
	publicPort: number;

	@ApiProperty()
	@IsBoolean()
	listening: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumErrorLength)
	failureReason?: string;
}

export class EdgeAccessSessionDto {
	@ApiProperty({ format: 'uuid' })
	sessionId: string;

	@ApiProperty({ format: 'date-time' })
	expiresAt: string;
}

export class EdgeHeartbeatDto {
	@ApiProperty({ format: 'date-time' })
	@IsDateString({ strict: true })
	startedAt: string;

	@ApiProperty()
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumVersionLength)
	version: string;

	@ApiProperty()
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumVersionLength)
	routeTableVersion: string;

	@ApiProperty({ type: EdgeCapacitySnapshotDto })
	@ValidateNested()
	@Type(() => EdgeCapacitySnapshotDto)
	capacity: EdgeCapacitySnapshotDto;

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@ArrayMaxSize(EDGE_CONTROL_LIMITS.maximumAccessSessionsPerHeartbeat)
	@IsUUID(undefined, { each: true })
	activeAccessSessionIds?: string[];

	@ApiPropertyOptional({ type: [EdgeBindingAcknowledgementDto] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(EDGE_CONTROL_LIMITS.maximumBindingAcknowledgementsPerHeartbeat)
	@ValidateNested({ each: true })
	@Type(() => EdgeBindingAcknowledgementDto)
	bindingAcknowledgements?: EdgeBindingAcknowledgementDto[];

	@ApiProperty({ type: [EdgeRouteListenerStatusDto] })
	@IsArray()
	@ArrayMaxSize(EDGE_CONTROL_LIMITS.maximumListenerStatusesPerHeartbeat)
	@ValidateNested({ each: true })
	@Type(() => EdgeRouteListenerStatusDto)
	routeListeners: EdgeRouteListenerStatusDto[];
}

export class EdgeHeartbeatResponseDto {
	@ApiProperty({ format: 'uuid' })
	edgeId: string;

	@ApiProperty({ enum: EDGE_STATUS, enumName: 'EdgeStatus' })
	status: EdgeStatus;

	@ApiProperty({ type: EdgeCapacityProfileDto })
	capacityProfile: EdgeCapacityProfileDto;

	@ApiProperty()
	routeTableVersion: string;

	@ApiProperty({ type: [EdgeAccessSessionDto] })
	accessSessions: EdgeAccessSessionDto[];

	@ApiProperty({ type: [String] })
	revokedAccessSessionIds: string[];
}
