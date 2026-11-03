/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/organization/access';
import {
	ORGANIZATION_PRESET_ROLE,
	ORGANIZATION_ROLE,
} from './organization-roles.js';

export const CREDENTIAL_ASSIGNABLE_STATEMENT = {
	sandboxes: ['write', 'delete'],
	snapshots: ['write', 'delete'],
	registries: ['write', 'delete'],
	volumes: ['read', 'write', 'delete'],
	machines: ['read', 'write', 'delete'],
	audit_logs: ['read'],
	billing: ['read', 'manage'],
	secrets: ['read', 'write', 'use', 'delete'],
	listings: ['read', 'write'],
} as const;

export const ORGANIZATION_STATEMENT = {
	organization: defaultStatements.organization,
	member: defaultStatements.member,
	invitation: defaultStatements.invitation,
	ac: defaultStatements.ac,
	apiKey: ['create', 'read', 'update', 'delete'],
	payouts: ['read', 'manage'],
	...CREDENTIAL_ASSIGNABLE_STATEMENT,
} as const;

export const organizationAccessControl = createAccessControl(
	ORGANIZATION_STATEMENT
);

export const ORGANIZATION_ROLES = {
	[ORGANIZATION_ROLE.OWNER]: organizationAccessControl.newRole(
		ORGANIZATION_STATEMENT
	),
	[ORGANIZATION_ROLE.ADMIN]: organizationAccessControl.newRole({
		...ORGANIZATION_STATEMENT,
		organization: ['update'],
	}),
	[ORGANIZATION_ROLE.MEMBER]: organizationAccessControl.newRole({
		volumes: ['read'],
		machines: ['read'],
		ac: ['read'],
		listings: ['read'],
	}),
	[ORGANIZATION_PRESET_ROLE.DEVELOPER]: organizationAccessControl.newRole({
		sandboxes: ['write', 'delete'],
		snapshots: ['write'],
		registries: ['write'],
		volumes: ['read', 'write'],
		secrets: ['read', 'use'],
		machines: ['read'],
	}),
	[ORGANIZATION_PRESET_ROLE.SANDBOXES_ADMIN]: organizationAccessControl.newRole(
		{ sandboxes: ['write', 'delete'] }
	),
	[ORGANIZATION_PRESET_ROLE.SNAPSHOTS_ADMIN]: organizationAccessControl.newRole(
		{ snapshots: ['write', 'delete'] }
	),
	[ORGANIZATION_PRESET_ROLE.REGISTRIES_ADMIN]:
		organizationAccessControl.newRole({ registries: ['write', 'delete'] }),
	[ORGANIZATION_PRESET_ROLE.VOLUMES_ADMIN]: organizationAccessControl.newRole({
		volumes: ['read', 'write', 'delete'],
	}),
	[ORGANIZATION_PRESET_ROLE.INFRASTRUCTURE_ADMIN]:
		organizationAccessControl.newRole({
			machines: ['read', 'write', 'delete'],
			listings: ['read', 'write'],
		}),
	[ORGANIZATION_PRESET_ROLE.SECRETS_ADMIN]: organizationAccessControl.newRole({
		secrets: ['read', 'write', 'use', 'delete'],
	}),
	[ORGANIZATION_PRESET_ROLE.AUDITOR]: organizationAccessControl.newRole({
		audit_logs: ['read'],
		volumes: ['read'],
		machines: ['read'],
		billing: ['read'],
		listings: ['read'],
		payouts: ['read'],
	}),
	[ORGANIZATION_PRESET_ROLE.BILLING_ADMIN]: organizationAccessControl.newRole({
		billing: ['read', 'manage'],
		payouts: ['read', 'manage'],
	}),
};

type PermissionsOf<Statement extends Record<string, readonly string[]>> =
	Partial<{ [Resource in keyof Statement]: Statement[Resource][number][] }>;

export type OrganizationStatement = typeof ORGANIZATION_STATEMENT;
export type OrganizationResource = keyof OrganizationStatement;
export type OrganizationRoleName = keyof typeof ORGANIZATION_ROLES;
export type OrganizationPermissions = PermissionsOf<OrganizationStatement>;
export type CredentialPermissions = PermissionsOf<
	typeof CREDENTIAL_ASSIGNABLE_STATEMENT
>;

export function isStaticOrganizationRole(
	role: string
): role is OrganizationRoleName {
	return Object.hasOwn(ORGANIZATION_ROLES, role);
}
