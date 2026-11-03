/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	CREDENTIAL_ASSIGNABLE_STATEMENT,
	type CredentialPermissions,
	isOrganizationBaseRole,
} from '@snapflow/organization-access';

type CredentialResource = keyof typeof CREDENTIAL_ASSIGNABLE_STATEMENT;

export interface PermissionPair {
	resource: string;
	action: string;
}

export function permissionPairs(
	permissions: Readonly<Record<string, readonly string[] | undefined>>
): PermissionPair[] {
	return Object.entries(permissions).flatMap(([resource, actions]) =>
		(actions ?? []).map((action) => ({ resource, action }))
	);
}

export function grantsPermission(
	granted: Readonly<Record<string, readonly string[] | undefined>>,
	{ resource, action }: PermissionPair
): boolean {
	return granted[resource]?.includes(action) ?? false;
}

export function toPermissionRecord(
	pairs: readonly PermissionPair[]
): Record<string, string[]> {
	const record: Record<string, string[]> = {};
	for (const { resource, action } of pairs) {
		record[resource] = [...(record[resource] ?? []), action];
	}
	return record;
}

export function isCredentialPermissions(
	value: unknown
): value is CredentialPermissions {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}
	const entries = Object.entries(value);
	return (
		entries.length > 0 &&
		entries.every(
			([resource, actions]) =>
				isCredentialResource(resource) &&
				isGrantableActionList(resource, actions)
		)
	);
}

export function toCredentialPermissions(
	stored: Record<string, string[]> | null | undefined
): CredentialPermissions {
	const permissions: Record<string, string[]> = {};
	for (const [resource, known] of Object.entries(
		CREDENTIAL_ASSIGNABLE_STATEMENT
	)) {
		const actions: readonly string[] = known;
		const granted = stored?.[resource]?.filter((action) =>
			actions.includes(action)
		);
		if (granted?.length) permissions[resource] = granted;
	}
	return isCredentialPermissions(permissions) ? permissions : {};
}

export function countBaseRoles(roles: readonly string[]): number {
	return roles.filter(isOrganizationBaseRole).length;
}

function isCredentialResource(
	resource: string
): resource is CredentialResource {
	return Object.hasOwn(CREDENTIAL_ASSIGNABLE_STATEMENT, resource);
}

function isGrantableActionList(
	resource: CredentialResource,
	actions: unknown
): boolean {
	const known: readonly string[] = CREDENTIAL_ASSIGNABLE_STATEMENT[resource];
	return (
		Array.isArray(actions) &&
		actions.length > 0 &&
		new Set(actions).size === actions.length &&
		actions.every(
			(action) => typeof action === 'string' && known.includes(action)
		)
	);
}
