/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AdminOrganization } from '@snapflow/api-client';

type AdminOrganizationStatusId = 'active' | 'suspended' | 'deleted';

const STATUSES = {
	deleted: { label: 'Deleted', variant: 'gray' },
	suspended: { label: 'Suspended', variant: 'red' },
	active: { label: 'Active', variant: 'green' },
} as const;

export function adminOrganizationStatusId(
	organization: AdminOrganization
): AdminOrganizationStatusId {
	if (organization.deletedAt) return 'deleted';
	return organization.suspended ? 'suspended' : 'active';
}

export function adminOrganizationStatus(organization: AdminOrganization) {
	return STATUSES[adminOrganizationStatusId(organization)];
}
