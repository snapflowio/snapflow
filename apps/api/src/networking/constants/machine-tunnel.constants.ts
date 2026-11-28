/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const TUNNEL_CARRIER = {
	QUIC: 'quic',
	HTTP2: 'http2',
} as const;
export type TunnelCarrier =
	(typeof TUNNEL_CARRIER)[keyof typeof TUNNEL_CARRIER];

export const MACHINE_EDGE_BINDING_STATE = {
	PENDING: 'pending',
	ACTIVE: 'active',
	REPLACING: 'replacing',
	DRAINING: 'draining',
	FAILED: 'failed',
	RELEASED: 'released',
} as const;
export type MachineEdgeBindingState =
	(typeof MACHINE_EDGE_BINDING_STATE)[keyof typeof MACHINE_EDGE_BINDING_STATE];

export const MACHINE_EDGE_BINDING_DESIRED_STATE = {
	ACTIVE: 'active',
	DRAINING: 'draining',
	RELEASED: 'released',
} as const;
export type MachineEdgeBindingDesiredState =
	(typeof MACHINE_EDGE_BINDING_DESIRED_STATE)[keyof typeof MACHINE_EDGE_BINDING_DESIRED_STATE];

export const LIVE_BINDING_STATES = [
	MACHINE_EDGE_BINDING_STATE.PENDING,
	MACHINE_EDGE_BINDING_STATE.ACTIVE,
	MACHINE_EDGE_BINDING_STATE.REPLACING,
	MACHINE_EDGE_BINDING_STATE.DRAINING,
] as const;

export const TUNNEL_CERTIFICATE_AUTHORITY = {
	MOUNT: 'pki',
	ROLE: 'snapflow-tunnel-machine',
	CERTIFICATE_TTL_SECONDS: 600,
} as const;
