/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type ExposureVisibility } from '../constants/exposure.constants';
import {
	type HttpUpstreamProtocol,
	NETWORK_PROTOCOL,
	type NetworkProtocol,
	type ProxyProtocol,
} from '../constants/networking.constants';

interface NetworkPortRange {
	from: number;
	to: number;
}

export interface EdgeTunnelAddress {
	host: string;
	port: number;
}

export interface EdgePublicAddress {
	host: string;
	address: string;
	protocols: NetworkProtocol[];
}

export interface EdgePortInventory {
	tcp: NetworkPortRange[];
	udp: NetworkPortRange[];
}

export interface EdgeCapacityProfile {
	version: number;
	tunnels: number;
	httpRequests: number;
	httpConnections: number;
	httpStreams: number;
	tcpConnections: number;
	udpFlows: number;
	bytesPerSecondIn: number;
	bytesPerSecondOut: number;
	packetsPerSecond: number;
}

export interface EdgeCapacitySnapshot extends EdgeCapacityProfile {
	placementEligible: boolean;
	routeCount: number;
	tunnelHeadroom: number;
	httpRequestHeadroom: number;
	httpConnectionHeadroom: number;
	httpStreamHeadroom: number;
	tcpConnectionHeadroom: number;
	udpFlowHeadroom: number;
	cpuUtilization: number;
	memoryUtilization: number;
	packetDrops: number;
}

interface HttpExposurePolicy {
	protocol: typeof NETWORK_PROTOCOL.HTTP;
	visibility: ExposureVisibility;
	path: string;
	stripPath: boolean;
	forceHttps: boolean;
	maxBodyBytes: number;
	readTimeoutSeconds: number;
	sendTimeoutSeconds: number;
	retries: number;
	streaming: boolean;
	upstreamProtocol: HttpUpstreamProtocol;
	allowedOrigins: string[];
	allowCredentials: boolean;
	showBrowserWarning: boolean;
}

interface TcpExposurePolicy {
	protocol: typeof NETWORK_PROTOCOL.TCP;
	proxyProtocol: ProxyProtocol;
	idleTimeoutSeconds: number;
	connectionLimit: number;
}

interface UdpExposurePolicy {
	protocol: typeof NETWORK_PROTOCOL.UDP;
	idleTimeoutSeconds: number;
	flowLimit: number;
	packetsPerSecond: number;
	maximumDatagramPayloadBytes: number;
}

export type ExposurePolicy =
	| HttpExposurePolicy
	| TcpExposurePolicy
	| UdpExposurePolicy;

export interface DomainVerificationRecord {
	type: 'CNAME' | 'TXT';
	name: string;
	value: string;
}

export interface ManagedCustomHostname {
	id: string;
	hostnameStatus: string | null;
	certificateStatus: string | null;
	verificationRecords: DomainVerificationRecord[];
	errors: string[];
}

export interface EdgeUsageCheckpointPayload {
	intervalStartedAt: string;
	intervalEndedAt: string;
	samples: Array<{
		backendId: string;
		assignmentGeneration: number;
		protocol: NetworkProtocol;
		bytesIn: string;
		bytesOut: string;
		packetsIn: string;
		packetsOut: string;
		tcpConnections: number;
		udpFlows: number;
	}>;
}
