/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum NetworkingErrorCode {
	EXPOSURE_NOT_FOUND = 'exposure_not_found',
	EXPOSURE_PORT_INVALID = 'exposure_port_invalid',
	EXPOSURE_NAME_TAKEN = 'exposure_name_taken',
	EXPOSURE_LIMIT_REACHED = 'exposure_limit_reached',
	EXPOSURE_HOSTNAME_TOO_LONG = 'exposure_hostname_too_long',
	EXPOSURE_DELETING = 'exposure_deleting',
	EXPOSURE_IMMUTABLE = 'exposure_immutable',
	EXPOSURE_NOT_PROTECTED = 'exposure_not_protected',
	EXPOSURE_NOT_READY = 'exposure_not_ready',
	EXPOSURE_CUTOVER_STATE_INVALID = 'exposure_cutover_state_invalid',
	ACCESS_LIFETIME_INVALID = 'access_lifetime_invalid',
	ACCESS_GRANT_INVALID = 'access_grant_invalid',
	SSH_ACCESS_INVALID = 'ssh_access_invalid',
	SSH_RELAY_NOT_READY = 'ssh_relay_not_ready',
	SSH_RELAY_UNSUPPORTED = 'ssh_relay_unsupported',
	BUILD_LOGS_UNAVAILABLE = 'sandbox_build_logs_unavailable',
	EDGE_NOT_FOUND = 'edge_not_found',
	EDGE_STATE_INVALID = 'edge_state_invalid',
	EDGE_IDENTITY_REGISTERED = 'edge_identity_registered',
	EDGE_ENROLLMENT_INVALID = 'edge_enrollment_invalid',
	EDGE_NOT_ELIGIBLE = 'edge_not_eligible',
	EDGE_SESSION_INVALID = 'edge_session_invalid',
	EDGE_SESSION_FENCED = 'edge_session_fenced',
	EDGE_PORT_RANGE_INVALID = 'edge_port_range_invalid',
	EDGE_CAPACITY_EXHAUSTED = 'edge_capacity_exhausted',
	EDGE_REPORT_INVALID = 'edge_report_invalid',
	EDGE_USAGE_EPOCH_CLOSED = 'edge_usage_epoch_closed',
	EDGE_ROUTES_UNAVAILABLE = 'edge_routes_unavailable',
	MACHINE_TUNNEL_FENCED = 'machine_tunnel_fenced',
	MACHINE_TUNNEL_PLAN_INVALID = 'machine_tunnel_plan_invalid',
	TUNNEL_CERTIFICATE_UNAVAILABLE = 'tunnel_certificate_unavailable',
}
