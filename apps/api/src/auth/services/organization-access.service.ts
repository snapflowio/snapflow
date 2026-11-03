/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import {
	type CredentialPermissions,
	ORGANIZATION_ROLE_SEPARATOR,
} from '@snapflow/organization-access';
import {
	AUTH_CREDENTIAL_TYPES,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import {
	grantsPermission,
	type PermissionPair,
	permissionPairs,
	toPermissionRecord,
} from '../../organization/tenant/utils/organization-permissions.util';
import type { Auth } from '../better-auth/better-auth.config';
import { InjectBetterAuth } from '../better-auth/better-auth.provider';

@Injectable()
export class OrganizationAccessService {
	constructor(@InjectBetterAuth() private readonly auth: Auth) {}

	async grantedPermissions(
		organizationId: string,
		role: string,
		requested: readonly PermissionPair[]
	): Promise<PermissionPair[]> {
		if (requested.length === 0) return [];
		const { permissions } = await this.auth.api.checkOrganizationPermissions({
			body: {
				organizationId,
				role,
				permissions: toPermissionRecord(requested),
			},
		});
		return permissionPairs(permissions);
	}

	grantedToContext(
		context: OrganizationAuthContext,
		requested: readonly PermissionPair[]
	): Promise<PermissionPair[]> {
		const { credential } = context;
		return this.grantedToMember(
			context.organizationId,
			context.memberRoles,
			credential.type === AUTH_CREDENTIAL_TYPES.API_KEY
				? credential.permissions
				: null,
			requested
		);
	}

	// An API key acts with the intersection of its own permissions and its
	// creator's member roles; a session acts with the member roles alone.
	grantedToMember(
		organizationId: string,
		memberRoles: readonly string[],
		credentialPermissions: CredentialPermissions | null,
		requested: readonly PermissionPair[]
	): Promise<PermissionPair[]> {
		const scoped = credentialPermissions
			? requested.filter((pair) =>
					grantsPermission(credentialPermissions, pair)
				)
			: requested;
		return this.grantedPermissions(
			organizationId,
			memberRoles.join(ORGANIZATION_ROLE_SEPARATOR),
			scoped
		);
	}
}
