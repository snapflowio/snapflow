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
	RESOURCE_HOLD_UPDATED: 'sandbox.resource-hold.updated',
	CREATED: 'sandbox.created',
	STARTED: 'sandbox.started',
	STOPPED: 'sandbox.stopped',
	DESTROYED: 'sandbox.destroyed',
	MACHINE_UPDATED: 'sandbox.machine.updated',
	BACKUP_CREATED: 'sandbox.backup.created',
	BACKUP_COMPLETED: 'sandbox.backup.completed',
	PRICE_INCREASE_SCHEDULED: 'sandbox.price.increase-scheduled',
} as const;
