/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { CredentialPermissions } from '@snapflow/organization-access';
import { SystemRole } from '../../user/enums/system-role.enum';
import {
	type BaseAuthContext,
	isBaseAuthContext,
} from './base-auth-context.types';
import type { HumanPrincipal } from './platform-principal.types';

export const AUTH_CREDENTIAL_TYPES = {
	SESSION: 'session',
	API_KEY: 'api-key',
} as const;

interface SessionCredential {
	type: typeof AUTH_CREDENTIAL_TYPES.SESSION;
	id: string;
}

interface ApiKeyCredential {
	type: typeof AUTH_CREDENTIAL_TYPES.API_KEY;
	id: string;
	name: string;
	permissions: CredentialPermissions;
}

export type AuthCredential = SessionCredential | ApiKeyCredential;

export interface OrganizationAuthContext extends BaseAuthContext {
	role: SystemRole;
	principal: HumanPrincipal;
	userId: string;
	email: string;
	organizationId: string;
	memberId: string;
	memberRoles: string[];
	credential: AuthCredential;
}

function hasString(value: object, key: string): boolean {
	return key in value && typeof Reflect.get(value, key) === 'string';
}

export function isOrganizationAuthContext(
	user: unknown
): user is OrganizationAuthContext {
	if (
		!isBaseAuthContext(user) ||
		!Object.values(SystemRole).includes(user.role as SystemRole) ||
		!['userId', 'email', 'organizationId', 'memberId'].every((key) =>
			hasString(user, key)
		) ||
		!('memberRoles' in user) ||
		!Array.isArray(user.memberRoles) ||
		!('credential' in user) ||
		typeof user.credential !== 'object' ||
		user.credential === null ||
		!('type' in user.credential)
	) {
		return false;
	}

	return Object.values(AUTH_CREDENTIAL_TYPES).includes(
		user.credential
			.type as (typeof AUTH_CREDENTIAL_TYPES)[keyof typeof AUTH_CREDENTIAL_TYPES]
	);
}
