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
	ORGANIZATION_STATEMENT,
	type OrganizationResource,
	type OrganizationRoleName,
	type OrganizationStatement,
	parseOrganizationRoles,
} from '@snapflow/organization-access';
import { isOrganizationResource } from './organization-resources.ts';

type OrganizationAction<Resource extends OrganizationResource> =
	OrganizationStatement[Resource][number];

export type OrganizationPermissionRequest = {
	[Resource in OrganizationResource]?: OrganizationAction<Resource>[];
};

export type OrganizationPermission = {
	[Resource in OrganizationResource]: Record<
		Resource,
		[OrganizationAction<Resource>]
	>;
}[OrganizationResource];

export interface ResourceActionPermissions {
	canDelete: boolean;
	canWrite: boolean;
}

export interface CustomRolePermissions {
	permission: Readonly<Record<string, readonly string[] | undefined>>;
	role: string;
}

export type StaticRoleCheck = (
	role: OrganizationRoleName,
	permissions: OrganizationPermissionRequest
) => boolean;

interface MemberPermissionContext {
	customRoles: readonly CustomRolePermissions[];
	memberRole: string;
	staticRoleCheck: StaticRoleCheck;
}

function customRoleGrants(
	customRole: CustomRolePermissions | undefined,
	permission: Readonly<Record<string, readonly string[]>>
): boolean {
	return Object.entries(permission).every(([resource, actions]) =>
		actions.every(
			(action) => customRole?.permission[resource]?.includes(action) ?? false
		)
	);
}

export function memberGrantsPermission(
	{ customRoles, memberRole, staticRoleCheck }: MemberPermissionContext,
	permission: OrganizationPermission
): boolean {
	return parseOrganizationRoles(memberRole).some((role) =>
		isStaticOrganizationRole(role)
			? staticRoleCheck(role, permission)
			: customRoleGrants(
					customRoles.find((customRole) => customRole.role === role),
					permission
				)
	);
}

export function hasCustomRoles(memberRole: string): boolean {
	return parseOrganizationRoles(memberRole).some(
		(role) => !isStaticOrganizationRole(role)
	);
}

function isStatementAction(
	resource: OrganizationResource,
	action: string
): boolean {
	const known: readonly string[] = ORGANIZATION_STATEMENT[resource];
	return known.includes(action);
}

function isOrganizationPermission(
	value: Readonly<Record<string, string[]>>
): value is OrganizationPermission {
	const entries = Object.entries(value);
	return (
		entries.length === 1 &&
		entries.every(
			([resource, actions]) =>
				isOrganizationResource(resource) &&
				actions.length === 1 &&
				actions.every((action) => isStatementAction(resource, action))
		)
	);
}

export function toOrganizationPermission(
	resource: string,
	action: string
): OrganizationPermission | null {
	const candidate = { [resource]: [action] };
	return isOrganizationPermission(candidate) ? candidate : null;
}
