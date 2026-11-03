/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiExtraModels,
	ApiProperty,
	ApiPropertyOptional,
	getSchemaPath,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayUnique,
	Equals,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUrl,
	Matches,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import { IsSafeDisplayString } from '../../../common/validators/is-safe-string.validator';
import {
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_KIND,
	EXPOSURE_OBSERVED_STATE,
	EXPOSURE_VISIBILITY,
	type ExposureDesiredState,
	type ExposureKind,
	type ExposureObservedState,
	type ExposureVisibility,
	HTTP_EXPOSURE_PATH_PATTERN,
	SYSTEM_EXPOSURE_LEASE,
	SYSTEM_EXPOSURE_SERVICE,
	type SystemExposureService,
} from '../constants/exposure.constants';
import {
	HTTP_UPSTREAM_PROTOCOL,
	type HttpUpstreamProtocol,
	NETWORK_PROTOCOL,
	NETWORKING_LIMITS,
	type NetworkProtocol,
	PROXY_PROTOCOL,
	type ProxyProtocol,
} from '../constants/networking.constants';

const EXPOSURE_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

class HttpExposurePolicyDto {
	@ApiProperty({ enum: [NETWORK_PROTOCOL.HTTP] })
	@Equals(NETWORK_PROTOCOL.HTTP)
	protocol: typeof NETWORK_PROTOCOL.HTTP;

	@ApiProperty({ enum: EXPOSURE_VISIBILITY, enumName: 'ExposureVisibility' })
	@IsEnum(EXPOSURE_VISIBILITY)
	visibility: ExposureVisibility;

	@ApiProperty({ default: '/' })
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumHttpPathLength)
	@Matches(HTTP_EXPOSURE_PATH_PATTERN)
	path: string;

	@ApiProperty({ default: false })
	@IsBoolean()
	stripPath: boolean;

	@ApiProperty({ default: true })
	@IsBoolean()
	forceHttps: boolean;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	@Max(NETWORKING_LIMITS.maximumHttpBodyBytes)
	maxBodyBytes: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	@Max(NETWORKING_LIMITS.maximumTimeoutSeconds)
	readTimeoutSeconds: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	@Max(NETWORKING_LIMITS.maximumTimeoutSeconds)
	sendTimeoutSeconds: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	@Max(NETWORKING_LIMITS.maximumRetries)
	retries: number;

	@ApiProperty()
	@IsBoolean()
	streaming: boolean;

	@ApiProperty({
		enum: HTTP_UPSTREAM_PROTOCOL,
		enumName: 'HttpUpstreamProtocol',
	})
	@IsEnum(HTTP_UPSTREAM_PROTOCOL)
	upstreamProtocol: HttpUpstreamProtocol;

	@ApiProperty({ type: [String] })
	@IsArray()
	@ArrayUnique()
	@ArrayMaxSize(NETWORKING_LIMITS.maximumAllowedOrigins)
	@IsUrl({ require_tld: false }, { each: true })
	allowedOrigins: string[];

	@ApiProperty()
	@IsBoolean()
	allowCredentials: boolean;

	@ApiProperty()
	@IsBoolean()
	showBrowserWarning: boolean;
}

class TcpExposurePolicyDto {
	@ApiProperty({ enum: [NETWORK_PROTOCOL.TCP] })
	@Equals(NETWORK_PROTOCOL.TCP)
	protocol: typeof NETWORK_PROTOCOL.TCP;

	@ApiProperty({ enum: PROXY_PROTOCOL, enumName: 'ProxyProtocol' })
	@IsEnum(PROXY_PROTOCOL)
	proxyProtocol: ProxyProtocol;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@IsInt()
	@Min(1)
	@Max(NETWORKING_LIMITS.maximumTimeoutSeconds)
	idleTimeoutSeconds: number;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@IsInt()
	@Min(1)
	@Max(NETWORKING_LIMITS.maximumConnectionOrFlowLimit)
	connectionLimit: number;
}

class UdpExposurePolicyDto {
	@ApiProperty({ enum: [NETWORK_PROTOCOL.UDP] })
	@Equals(NETWORK_PROTOCOL.UDP)
	protocol: typeof NETWORK_PROTOCOL.UDP;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@IsInt()
	@Min(1)
	@Max(NETWORKING_LIMITS.maximumTimeoutSeconds)
	idleTimeoutSeconds: number;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@IsInt()
	@Min(1)
	@Max(NETWORKING_LIMITS.maximumConnectionOrFlowLimit)
	flowLimit: number;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@IsInt()
	@Min(1)
	@Max(NETWORKING_LIMITS.maximumConnectionOrFlowLimit)
	packetsPerSecond: number;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@IsInt()
	@Min(1)
	@Max(NETWORKING_LIMITS.maximumDatagramPayloadBytes)
	maximumDatagramPayloadBytes: number;
}

export type ExposurePolicyDto =
	| HttpExposurePolicyDto
	| TcpExposurePolicyDto
	| UdpExposurePolicyDto;

@ApiExtraModels(
	HttpExposurePolicyDto,
	TcpExposurePolicyDto,
	UdpExposurePolicyDto
)
export class CreateExposureDto {
	@ApiProperty({ example: 'web' })
	@IsString()
	@IsSafeDisplayString()
	@Matches(EXPOSURE_NAME_PATTERN)
	@MaxLength(NETWORKING_LIMITS.maximumNameLength)
	name: string;

	@ApiProperty({ type: 'integer', minimum: 1, maximum: 65_535 })
	@IsInt()
	@Min(NETWORKING_LIMITS.minimumPort)
	@Max(NETWORKING_LIMITS.maximumPort)
	targetPort: number;

	@ApiProperty({
		oneOf: [
			{ $ref: getSchemaPath(HttpExposurePolicyDto) },
			{ $ref: getSchemaPath(TcpExposurePolicyDto) },
			{ $ref: getSchemaPath(UdpExposurePolicyDto) },
		],
		discriminator: { propertyName: 'protocol' },
	})
	@ValidateNested()
	@Type(() => Object, {
		discriminator: {
			property: 'protocol',
			subTypes: [
				{ name: NETWORK_PROTOCOL.HTTP, value: HttpExposurePolicyDto },
				{ name: NETWORK_PROTOCOL.TCP, value: TcpExposurePolicyDto },
				{ name: NETWORK_PROTOCOL.UDP, value: UdpExposurePolicyDto },
			],
		},
		keepDiscriminatorProperty: true,
	})
	policy: ExposurePolicyDto;
}

@ApiExtraModels(
	HttpExposurePolicyDto,
	TcpExposurePolicyDto,
	UdpExposurePolicyDto
)
export class UpdateExposureDto {
	@ApiProperty({ type: 'integer', minimum: 1, maximum: 65_535 })
	@IsInt()
	@Min(NETWORKING_LIMITS.minimumPort)
	@Max(NETWORKING_LIMITS.maximumPort)
	targetPort: number;

	@ApiProperty({
		oneOf: [
			{ $ref: getSchemaPath(HttpExposurePolicyDto) },
			{ $ref: getSchemaPath(TcpExposurePolicyDto) },
			{ $ref: getSchemaPath(UdpExposurePolicyDto) },
		],
		discriminator: { propertyName: 'protocol' },
	})
	@ValidateNested()
	@Type(() => Object, {
		discriminator: {
			property: 'protocol',
			subTypes: [
				{ name: NETWORK_PROTOCOL.HTTP, value: HttpExposurePolicyDto },
				{ name: NETWORK_PROTOCOL.TCP, value: TcpExposurePolicyDto },
				{ name: NETWORK_PROTOCOL.UDP, value: UdpExposurePolicyDto },
			],
		},
		keepDiscriminatorProperty: true,
	})
	policy: ExposurePolicyDto;
}

export class ExposureDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ format: 'uuid' })
	organizationId: string;

	@ApiProperty()
	sandboxId: string;

	@ApiProperty()
	name: string;

	@ApiProperty({ enum: EXPOSURE_KIND, enumName: 'ExposureKind' })
	kind: ExposureKind;

	@ApiProperty({ enum: NETWORK_PROTOCOL, enumName: 'NetworkProtocol' })
	protocol: NetworkProtocol;

	@ApiPropertyOptional({
		enum: EXPOSURE_VISIBILITY,
		enumName: 'ExposureVisibility',
	})
	visibility?: ExposureVisibility;

	@ApiPropertyOptional({
		enum: SYSTEM_EXPOSURE_SERVICE,
		enumName: 'SystemExposureService',
	})
	systemService?: SystemExposureService;

	@ApiProperty({ type: 'integer' })
	targetPort: number;

	@ApiProperty({
		oneOf: [
			{ $ref: getSchemaPath(HttpExposurePolicyDto) },
			{ $ref: getSchemaPath(TcpExposurePolicyDto) },
			{ $ref: getSchemaPath(UdpExposurePolicyDto) },
		],
		discriminator: { propertyName: 'protocol' },
	})
	policy: ExposurePolicyDto;

	@ApiProperty({
		enum: EXPOSURE_DESIRED_STATE,
		enumName: 'ExposureDesiredState',
	})
	desiredState: ExposureDesiredState;

	@ApiProperty({
		enum: EXPOSURE_OBSERVED_STATE,
		enumName: 'ExposureObservedState',
	})
	observedState: ExposureObservedState;

	@ApiProperty({ type: 'integer', minimum: 1 })
	generation: number;

	@ApiPropertyOptional()
	platformHostname?: string;

	@ApiPropertyOptional()
	originHostname?: string;

	@ApiPropertyOptional()
	lastError?: string;

	@ApiPropertyOptional({ format: 'date-time' })
	systemRequestedUntil?: string;

	@ApiProperty({ format: 'date-time' })
	createdAt: string;

	@ApiProperty({ format: 'date-time' })
	updatedAt: string;
}

export class RequestSystemExposureDto {
	@ApiPropertyOptional({
		type: 'integer',
		minimum: SYSTEM_EXPOSURE_LEASE.minimumDurationSeconds,
		maximum: SYSTEM_EXPOSURE_LEASE.maximumDurationSeconds,
		default: SYSTEM_EXPOSURE_LEASE.defaultDurationSeconds,
	})
	@IsOptional()
	@IsInt()
	@Min(SYSTEM_EXPOSURE_LEASE.minimumDurationSeconds)
	@Max(SYSTEM_EXPOSURE_LEASE.maximumDurationSeconds)
	durationSeconds?: number;
}
