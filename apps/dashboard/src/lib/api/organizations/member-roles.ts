/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	isOrganizationBaseRole,
	ORGANIZATION_ROLE,
	type OrganizationBaseRole,
	parseOrganizationRoles,
} from '@snapflow/organization-access';

export interface MemberRoles {
	additionalRoles: string[];
	baseRole: OrganizationBaseRole;
}

export function splitMemberRoles(role: string): MemberRoles {
	const roles = parseOrganizationRoles(role);
	return {
		baseRole: roles.find(isOrganizationBaseRole) ?? ORGANIZATION_ROLE.MEMBER,
		additionalRoles: roles.filter((name) => !isOrganizationBaseRole(name)),
	};
}

export function joinMemberRoles({
	additionalRoles,
	baseRole,
}: MemberRoles): string[] {
	return baseRole === ORGANIZATION_ROLE.MEMBER
		? [baseRole, ...additionalRoles]
		: [baseRole];
}
