/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	isStaticOrganizationRole,
	ORGANIZATION_PRESET_ROLE,
	type OrganizationRoleName,
} from '@snapflow/organization-access';

export const ORGANIZATION_PRESET_ROLES: readonly string[] = Object.values(
	ORGANIZATION_PRESET_ROLE
);

export const ORGANIZATION_ROLE_LABEL: Record<OrganizationRoleName, string> = {
	owner: 'Owner',
	admin: 'Admin',
	member: 'Member',
	developer: 'Developer',
	'sandboxes-admin': 'Sandboxes admin',
	'snapshots-admin': 'Snapshots admin',
	'registries-admin': 'Registries admin',
	'volumes-admin': 'Volumes admin',
	'infrastructure-admin': 'Infrastructure admin',
	'secrets-admin': 'Secrets admin',
	auditor: 'Auditor',
	'billing-admin': 'Billing admin',
};

export function organizationRoleLabel(role: string): string {
	return isStaticOrganizationRole(role) ? ORGANIZATION_ROLE_LABEL[role] : role;
}

export function formatOrganizationRoles(roles: readonly string[]): string {
	return roles.map(organizationRoleLabel).join(', ');
}
