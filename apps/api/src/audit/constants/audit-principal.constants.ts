/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const AUDIT_ACTOR_TYPE = {
	HUMAN: 'human',
	MACHINE: 'machine',
	EDGE: 'edge',
	HEALTH_CHECK: 'health_check',
	SYSTEM: 'system',
} as const;
export type AuditActorType =
	(typeof AUDIT_ACTOR_TYPE)[keyof typeof AUDIT_ACTOR_TYPE];

export const AUDIT_CREDENTIAL_TYPE = {
	SESSION: 'session',
	API_KEY: 'api_key',
	MACHINE_DPOP: 'machine_dpop',
	EDGE_SESSION: 'edge_session',
	HEALTH_KEY: 'health_key',
	SYSTEM: 'system',
} as const;
export type AuditCredentialType =
	(typeof AUDIT_CREDENTIAL_TYPE)[keyof typeof AUDIT_CREDENTIAL_TYPE];
