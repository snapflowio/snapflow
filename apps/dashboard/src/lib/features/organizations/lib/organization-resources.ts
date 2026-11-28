/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ORGANIZATION_STATEMENT,
	type OrganizationResource,
} from '@snapflow/organization-access';
import type { PermissionRecord } from '#lib/api/organizations/roles.ts';

type GrantedPermissions = Readonly<
	Record<string, readonly string[] | undefined>
>;

export const ORGANIZATION_RESOURCE_LABEL: Record<OrganizationResource, string> =
	{
		organization: 'Organization',
		member: 'Members',
		invitation: 'Invitations',
		ac: 'Roles',
		apiKey: 'API keys',
		payouts: 'Payouts',
		sandboxes: 'Sandboxes',
		snapshots: 'Snapshots',
		registries: 'Registries',
		volumes: 'Volumes',
		machines: 'Machines',
		audit_logs: 'Audit logs',
		billing: 'Billing',
		secrets: 'Secrets',
		listings: 'Listings',
		webhooks: 'Webhooks',
	};

const PERMISSION_SEPARATOR = ':';

export function isOrganizationResource(
	resource: string
): resource is OrganizationResource {
	return Object.hasOwn(ORGANIZATION_STATEMENT, resource);
}

export const ORGANIZATION_RESOURCES = Object.keys(
	ORGANIZATION_STATEMENT
).filter(isOrganizationResource);

export function resourceLabel(resource: string): string {
	return isOrganizationResource(resource)
		? ORGANIZATION_RESOURCE_LABEL[resource]
		: resource;
}

export function permissionKey(resource: string, action: string): string {
	return `${resource}${PERMISSION_SEPARATOR}${action}`;
}

export function permissionKeys(permissions: GrantedPermissions): string[] {
	return Object.entries(permissions).flatMap(([resource, actions]) =>
		(actions ?? []).map((action) => permissionKey(resource, action))
	);
}

export function permissionKeysToRecord(
	keys: readonly string[]
): PermissionRecord {
	const record: PermissionRecord = {};
	for (const key of keys) {
		const separatorIndex = key.indexOf(PERMISSION_SEPARATOR);
		const resource = key.slice(0, separatorIndex);
		const action = key.slice(separatorIndex + 1);
		record[resource] = [...(record[resource] ?? []), action];
	}
	return record;
}

export interface ScopeResource {
	resource: string;
	label: string;
	actions: readonly string[];
}

export function scopeResources(
	statement: Readonly<Record<string, readonly string[]>>
): ScopeResource[] {
	return Object.entries(statement).map(([resource, actions]) => ({
		resource,
		label: resourceLabel(resource),
		actions,
	}));
}

export function permissionScopes(
	permissions: GrantedPermissions | null | undefined
): ScopeResource[] {
	return Object.entries(permissions ?? {}).flatMap(([resource, actions]) =>
		actions && actions.length > 0
			? [{ resource, label: resourceLabel(resource), actions }]
			: []
	);
}

export function formatPermissionAreas(
	permissions: GrantedPermissions | null | undefined
): string | null {
	const scopes = permissionScopes(permissions);
	if (scopes.length === 0) return null;
	return scopes.map((scope) => scope.label).join(', ');
}
