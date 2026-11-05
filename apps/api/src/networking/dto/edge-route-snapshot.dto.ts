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
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_VISIBILITY,
	type ExposureBackendState,
	type ExposureVisibility,
} from '../constants/exposure.constants';
import {
	HTTP_UPSTREAM_PROTOCOL,
	type HttpUpstreamProtocol,
	NETWORK_PROTOCOL,
	PROXY_PROTOCOL,
	type ProxyProtocol,
} from '../constants/networking.constants';

export class EdgeMachineBindingDto {
	@ApiProperty({ format: 'uuid' })
	machineId: string;

	@ApiProperty({ type: 'integer', minimum: 1 })
	machineSessionGeneration: number;

	@ApiProperty({ format: 'uuid' })
	bindingId: string;

	@ApiProperty({ type: 'integer', minimum: 1 })
	bindingRevision: number;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	bindingDigest: string;

	@ApiProperty({ format: 'date-time' })
	leaseExpiresAt: string;
}

export class EdgeRouteBaseDto {
	@ApiProperty({ format: 'uuid' })
	backendId: string;

	@ApiProperty({
		enum: EXPOSURE_BACKEND_STATE,
		enumName: 'ExposureBackendState',
	})
	state: ExposureBackendState;

	@ApiProperty({ format: 'uuid' })
	machineId: string;

	@ApiProperty({ format: 'uuid' })
	ownerId: string;

	@ApiProperty({ format: 'uuid' })
	bindingId: string;

	@ApiProperty()
	interactive: boolean;

	@ApiProperty({ type: 'integer', minimum: 1 })
	assignmentGeneration: number;

	@ApiProperty({ type: 'integer', minimum: 1 })
	exposureGeneration: number;

	@ApiProperty()
	sandboxId: string;

	@ApiProperty({ format: 'uuid' })
	exposureId: string;

	@ApiProperty()
	exposureName: string;

	@ApiProperty()
	publicHost: string;

	@ApiProperty()
	targetHost: string;

	@ApiProperty({ type: 'integer', minimum: 1, maximum: 65_535 })
	targetPort: number;

	@ApiProperty({ format: 'date-time' })
	leaseExpiresAt: string;
}

export class EdgeHttpRoutePolicyDto {
	@ApiProperty({
		enum: EXPOSURE_VISIBILITY,
		enumName: 'ExposureVisibility',
	})
	visibility: ExposureVisibility;

	@ApiProperty()
	path: string;

	@ApiProperty()
	stripPath: boolean;

	@ApiProperty()
	forceHttps: boolean;

	@ApiProperty()
	requireTrustedProxy: boolean;

	@ApiProperty({ type: 'integer', format: 'int64', minimum: 0 })
	maxBodyBytes: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	readTimeoutSeconds: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	sendTimeoutSeconds: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	retries: number;

	@ApiProperty()
	streaming: boolean;

	@ApiProperty({
		enum: HTTP_UPSTREAM_PROTOCOL,
		enumName: 'HttpUpstreamProtocol',
	})
	upstreamProtocol: HttpUpstreamProtocol;

	@ApiProperty({ type: [String] })
	allowedOrigins: string[];

	@ApiProperty()
	allowCredentials: boolean;

	@ApiProperty()
	showBrowserWarning: boolean;
}

export class EdgeHttpRouteDto extends EdgeRouteBaseDto {
	@ApiProperty({ enum: [NETWORK_PROTOCOL.HTTP] })
	protocol: typeof NETWORK_PROTOCOL.HTTP;

	@ApiProperty({ type: 'integer', minimum: 0, maximum: 100 })
	trafficWeight: number;

	@ApiProperty({ type: [String] })
	hostnames: string[];

	@ApiProperty({ type: EdgeHttpRoutePolicyDto })
	policy: EdgeHttpRoutePolicyDto;
}

export class EdgeTcpRoutePolicyDto {
	@ApiProperty({ enum: PROXY_PROTOCOL, enumName: 'ProxyProtocol' })
	proxyProtocol: ProxyProtocol;

	@ApiProperty({ type: 'integer', minimum: 1 })
	idleTimeoutSeconds: number;

	@ApiProperty({ type: 'integer', minimum: 1 })
	connectionLimit: number;
}

export class EdgeTcpRouteDto extends EdgeRouteBaseDto {
	@ApiProperty({ enum: [NETWORK_PROTOCOL.TCP] })
	protocol: typeof NETWORK_PROTOCOL.TCP;

	@ApiProperty({ type: 'integer', minimum: 1, maximum: 65_535 })
	publicPort: number;

	@ApiProperty({ type: EdgeTcpRoutePolicyDto })
	policy: EdgeTcpRoutePolicyDto;
}

export class EdgeUdpRoutePolicyDto {
	@ApiProperty({ type: 'integer', minimum: 1 })
	idleTimeoutSeconds: number;

	@ApiProperty({ type: 'integer', minimum: 1 })
	flowLimit: number;

	@ApiProperty({ type: 'integer', minimum: 1 })
	packetsPerSecond: number;

	@ApiProperty({ type: 'integer', minimum: 1 })
	maximumDatagramPayloadBytes: number;
}

export class EdgeUdpRouteDto extends EdgeRouteBaseDto {
	@ApiProperty({ enum: [NETWORK_PROTOCOL.UDP] })
	protocol: typeof NETWORK_PROTOCOL.UDP;

	@ApiProperty({ type: 'integer', minimum: 1, maximum: 65_535 })
	publicPort: number;

	@ApiProperty({ type: EdgeUdpRoutePolicyDto })
	policy: EdgeUdpRoutePolicyDto;
}

export class EdgeRouteSnapshotDto {
	@ApiProperty({ format: 'uuid' })
	edgeId: string;

	@ApiProperty({ type: 'integer', minimum: 1 })
	edgeSessionGeneration: number;

	@ApiProperty({ description: 'Monotonic Edge route-table version' })
	version: string;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	digest: string;

	@ApiProperty({ format: 'date-time' })
	generatedAt: string;

	@ApiProperty({ format: 'date-time' })
	expiresAt: string;

	@ApiProperty({ type: [String] })
	trustedHttpProxyCidrs: string[];

	@ApiProperty({ type: [EdgeMachineBindingDto] })
	machineBindings: EdgeMachineBindingDto[];

	@ApiProperty({ type: [EdgeHttpRouteDto] })
	httpRoutes: EdgeHttpRouteDto[];

	@ApiProperty({ type: [EdgeTcpRouteDto] })
	tcpRoutes: EdgeTcpRouteDto[];

	@ApiProperty({ type: [EdgeUdpRouteDto] })
	udpRoutes: EdgeUdpRouteDto[];
}
