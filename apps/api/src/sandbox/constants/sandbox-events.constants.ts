/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SandboxEvents = {
	ARCHIVED: 'sandbox.archived',
	STATE_UPDATED: 'sandbox.state.updated',
	DESIRED_STATE_UPDATED: 'sandbox.desired-state.updated',
	CREATED: 'sandbox.created',
	STARTED: 'sandbox.started',
	STOPPED: 'sandbox.stopped',
	DESTROYED: 'sandbox.destroyed',
	MACHINE_UPDATED: 'sandbox.machine.updated',
	BACKUP_CREATED: 'sandbox.backup.created',
	LEASE_RENEWAL_REQUIRED: 'sandbox.lease.renewal-required',
} as const;
