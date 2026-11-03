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

export const ORGANIZATION_ROLE = {
	OWNER: 'owner',
	ADMIN: 'admin',
	MEMBER: 'member',
} as const;

export const ORGANIZATION_PRESET_ROLE = {
	DEVELOPER: 'developer',
	SANDBOXES_ADMIN: 'sandboxes-admin',
	SNAPSHOTS_ADMIN: 'snapshots-admin',
	REGISTRIES_ADMIN: 'registries-admin',
	VOLUMES_ADMIN: 'volumes-admin',
	INFRASTRUCTURE_ADMIN: 'infrastructure-admin',
	SECRETS_ADMIN: 'secrets-admin',
	AUDITOR: 'auditor',
	BILLING_ADMIN: 'billing-admin',
} as const;

export type OrganizationBaseRole =
	(typeof ORGANIZATION_ROLE)[keyof typeof ORGANIZATION_ROLE];

export const ORGANIZATION_ROLE_SEPARATOR = ',';

export const ORGANIZATION_BASE_ROLES: readonly OrganizationBaseRole[] =
	Object.values(ORGANIZATION_ROLE);

export const DEFAULT_INVITATION_ROLE = [
	ORGANIZATION_ROLE.MEMBER,
	ORGANIZATION_PRESET_ROLE.DEVELOPER,
].join(ORGANIZATION_ROLE_SEPARATOR);

export function isOrganizationBaseRole(
	role: string
): role is OrganizationBaseRole {
	return ORGANIZATION_BASE_ROLES.some((baseRole) => baseRole === role);
}

export function parseOrganizationRoles(role: string): string[] {
	return role
		.split(ORGANIZATION_ROLE_SEPARATOR)
		.map((name) => name.trim())
		.filter((name) => name.length > 0);
}
