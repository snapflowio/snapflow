/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const NETWORK_PROTOCOL = {
	HTTP: 'http',
	TCP: 'tcp',
	UDP: 'udp',
} as const;
export type NetworkProtocol =
	(typeof NETWORK_PROTOCOL)[keyof typeof NETWORK_PROTOCOL];
export const NETWORK_PROTOCOLS = Object.values(NETWORK_PROTOCOL);

export const HTTP_UPSTREAM_PROTOCOL = {
	HTTP: 'http',
	H2C: 'h2c',
} as const;
export type HttpUpstreamProtocol =
	(typeof HTTP_UPSTREAM_PROTOCOL)[keyof typeof HTTP_UPSTREAM_PROTOCOL];

export const PROXY_PROTOCOL = {
	DISABLED: 'disabled',
	V2: 'v2',
} as const;
export type ProxyProtocol =
	(typeof PROXY_PROTOCOL)[keyof typeof PROXY_PROTOCOL];

export const NETWORK_WAKE_TOPIC = {
	EDGE_ROUTES: 'edge-routes',
	MACHINE_TUNNEL_PLAN: 'machine-tunnel-plan',
	EXPOSURE_ACTIVATION: 'exposure-activation',
} as const;

export const ORIGIN_HOSTNAME_PREFIX = 'origin-';
const MAXIMUM_DNS_LABEL_LENGTH = 63;

export const NETWORKING_LIMITS = {
	maximumNameLength: 64,
	maximumHostnameLength: 253,
	maximumTargetReferenceLength: 512,
	maximumVersionLength: 128,
	maximumErrorLength: 1_000,
	maximumIdentityKeyIdLength: 128,
	maximumDnsLabelLength: MAXIMUM_DNS_LABEL_LENGTH,
	minimumPort: 1,
	maximumPort: 65_535,
	sha256HexLength: 64,
	routingKeyBytes:
		(MAXIMUM_DNS_LABEL_LENGTH - ORIGIN_HOSTNAME_PREFIX.length) / 2,
	maximumBindingRevision: 2_147_483_647,
	maximumExposuresPerSandbox: 64,
	maximumHttpPathLength: 2_048,
	maximumAllowedOrigins: 32,
	maximumRetries: 5,
	maximumTimeoutSeconds: 3_600,
	maximumHttpBodyBytes: 1_073_741_824,
	maximumConnectionOrFlowLimit: 1_000_000,
	maximumDatagramPayloadBytes: 32_768,
} as const;

export const NETWORKING_RECONCILIATION = {
	pollIntervalMilliseconds: 5 * 1_000,
	claimDurationMilliseconds: 30 * 1_000,
	backendLeaseDurationMilliseconds: 5 * 60 * 1_000,
	bindingLeaseDurationMilliseconds: 5 * 60 * 1_000,
	edgeHeartbeatMaximumAgeMilliseconds: 45 * 1_000,
	drainDurationMilliseconds: 30 * 1_000,
	baseRetryDelayMilliseconds: 1_000,
	maximumRetryDelayMilliseconds: 5 * 60 * 1_000,
	maximumRetryExponent: 8,
	claimBatchSize: 32,
	maximumPortCandidates: NETWORKING_LIMITS.maximumPort,
} as const;

export const NETWORKING_THROTTLE = {
	cloudflareWebhook: { limit: 120, ttl: 60_000 },
	edgeEnrollment: { limit: 10, ttl: 60_000 },
	edgeSession: { limit: 20, ttl: 60_000 },
} as const;
