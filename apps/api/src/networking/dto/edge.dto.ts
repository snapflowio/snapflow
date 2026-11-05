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
	ArrayNotEmpty,
	IsArray,
	IsEnum,
	IsInt,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import { IsSafeDisplayString } from '../../common/validators/is-safe-string.validator';
import { EDGE_STATUS, type EdgeStatus } from '../constants/edge.constants';
import {
	NETWORK_PROTOCOL,
	NETWORKING_LIMITS,
	type NetworkProtocol,
} from '../constants/networking.constants';
import type {
	EdgeCapacityProfile,
	EdgePortInventory,
	EdgePublicAddress,
	EdgeTunnelAddress,
} from '../types/networking.types';

export class NetworkPortRangeDto {
	@ApiProperty({ minimum: NETWORKING_LIMITS.minimumPort })
	@IsInt()
	@Min(NETWORKING_LIMITS.minimumPort)
	@Max(NETWORKING_LIMITS.maximumPort)
	from: number;

	@ApiProperty({ maximum: NETWORKING_LIMITS.maximumPort })
	@IsInt()
	@Min(NETWORKING_LIMITS.minimumPort)
	@Max(NETWORKING_LIMITS.maximumPort)
	to: number;
}

export class EdgeTunnelAddressDto implements EdgeTunnelAddress {
	@ApiProperty({ example: 'edge-us-east.example.com' })
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumHostnameLength)
	host: string;

	@ApiProperty({ minimum: 1, maximum: NETWORKING_LIMITS.maximumPort })
	@IsInt()
	@Min(NETWORKING_LIMITS.minimumPort)
	@Max(NETWORKING_LIMITS.maximumPort)
	port: number;
}

export class EdgePublicAddressDto implements EdgePublicAddress {
	@ApiProperty({ example: 'edge-us-east.example.com' })
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumHostnameLength)
	host: string;

	@ApiProperty({ example: '203.0.113.10' })
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumHostnameLength)
	address: string;

	@ApiProperty({
		enum: NETWORK_PROTOCOL,
		enumName: 'NetworkProtocol',
		isArray: true,
	})
	@IsArray()
	@ArrayNotEmpty()
	@IsEnum(NETWORK_PROTOCOL, { each: true })
	protocols: NetworkProtocol[];
}

export class EdgePortInventoryDto implements EdgePortInventory {
	@ApiProperty({ type: [NetworkPortRangeDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => NetworkPortRangeDto)
	tcp: NetworkPortRangeDto[];

	@ApiProperty({ type: [NetworkPortRangeDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => NetworkPortRangeDto)
	udp: NetworkPortRangeDto[];
}

export class EdgeCapacityProfileDto implements EdgeCapacityProfile {
	@ApiProperty({ type: 'integer', format: 'int32', minimum: 1 })
	@IsInt()
	@Min(1)
	version: number;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 0 })
	@IsInt()
	@Min(0)
	tunnels: number;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 0 })
	@IsInt()
	@Min(0)
	httpRequests: number;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 0 })
	@IsInt()
	@Min(0)
	httpConnections: number;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 0 })
	@IsInt()
	@Min(0)
	httpStreams: number;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 0 })
	@IsInt()
	@Min(0)
	tcpConnections: number;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 0 })
	@IsInt()
	@Min(0)
	udpFlows: number;

	@ApiProperty({ type: 'integer', format: 'int64', minimum: 0 })
	@IsInt()
	@Min(0)
	bytesPerSecondIn: number;

	@ApiProperty({ type: 'integer', format: 'int64', minimum: 0 })
	@IsInt()
	@Min(0)
	bytesPerSecondOut: number;

	@ApiProperty({ type: 'integer', format: 'int64', minimum: 0 })
	@IsInt()
	@Min(0)
	packetsPerSecond: number;
}

export class CreateEdgeDto {
	@ApiProperty({ example: 'edge-us-east-1' })
	@IsString()
	@IsSafeDisplayString()
	@MaxLength(NETWORKING_LIMITS.maximumNameLength)
	name: string;

	@ApiProperty({ example: 'edge-us-east.example.com' })
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumHostnameLength)
	publicHost: string;

	@ApiProperty({ type: EdgeTunnelAddressDto })
	@ValidateNested()
	@Type(() => EdgeTunnelAddressDto)
	tunnelAddress: EdgeTunnelAddressDto;

	@ApiProperty({ type: [EdgePublicAddressDto] })
	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => EdgePublicAddressDto)
	publicAddresses: EdgePublicAddressDto[];

	@ApiProperty({ type: EdgePortInventoryDto })
	@ValidateNested()
	@Type(() => EdgePortInventoryDto)
	portInventory: EdgePortInventoryDto;

	@ApiProperty({ type: EdgeCapacityProfileDto })
	@ValidateNested()
	@Type(() => EdgeCapacityProfileDto)
	capacityProfile: EdgeCapacityProfileDto;

	@ApiProperty({
		enum: NETWORK_PROTOCOL,
		enumName: 'NetworkProtocol',
		isArray: true,
	})
	@IsArray()
	@ArrayNotEmpty()
	@IsEnum(NETWORK_PROTOCOL, { each: true })
	supportedProtocols: NetworkProtocol[];
}

export class EdgeDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty({ enum: EDGE_STATUS, enumName: 'EdgeStatus' })
	status: EdgeStatus;

	@ApiProperty()
	publicHost: string;

	@ApiProperty({ type: EdgeTunnelAddressDto })
	tunnelAddress: EdgeTunnelAddress;

	@ApiProperty({ type: [EdgePublicAddressDto] })
	publicAddresses: EdgePublicAddress[];

	@ApiProperty({ type: EdgePortInventoryDto })
	portInventory: EdgePortInventory;

	@ApiProperty({ type: EdgeCapacityProfileDto })
	capacityProfile: EdgeCapacityProfile;

	@ApiProperty({
		enum: NETWORK_PROTOCOL,
		enumName: 'NetworkProtocol',
		isArray: true,
	})
	supportedProtocols: NetworkProtocol[];

	@ApiProperty({ type: 'integer', minimum: 1 })
	credentialGeneration: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	sessionGeneration: number;

	@ApiPropertyOptional({ format: 'date-time' })
	sessionExpiresAt?: string;

	@ApiPropertyOptional({ format: 'date-time' })
	lastHeartbeatAt?: string;

	@ApiProperty({ format: 'date-time' })
	createdAt: string;

	@ApiProperty({ format: 'date-time' })
	updatedAt: string;
}

export class EdgePageDto extends CursorPageDto<EdgeDto> {
	@ApiProperty({ type: EdgeDto, isArray: true })
	declare items: EdgeDto[];
}

export class CreateEdgeResponseDto extends EdgeDto {
	@ApiProperty({
		description: 'One-time secret returned only when it is issued',
	})
	enrollmentSecret: string;

	@ApiProperty({ format: 'date-time' })
	enrollmentSecretExpiresAt: string;
}

export class EdgeEnrollmentSecretDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	edgeId: string;

	@ApiProperty({
		description: 'One-time secret returned only when it is issued',
	})
	enrollmentSecret: string;

	@ApiProperty({ format: 'date-time' })
	enrollmentSecretExpiresAt: string;
}

export class UpdateEdgeStatusDto {
	@ApiProperty({ enum: EDGE_STATUS, enumName: 'EdgeStatus' })
	@IsEnum(EDGE_STATUS)
	status: EdgeStatus;
}
