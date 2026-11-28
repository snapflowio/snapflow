/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const OrganizationEvents = {
	ACTIVE_CHANGED: 'organization.active-changed',
	AUTHORIZATION_CHANGED: 'organization.authorization-changed',
	DELETED: 'organization.deleted',
	MEMBERSHIP_CHANGED: 'organization.membership-changed',
	ROLES_CHANGED: 'organization.roles-changed',
	SUSPENDED_SANDBOX_STOPPED: 'organization.suspended-sandbox-stopped',
	SUSPENDED_SNAPSHOT_DEACTIVATED: 'organization.suspended-snapshot-deactivated',
} as const;
