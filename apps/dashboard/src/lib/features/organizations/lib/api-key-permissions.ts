/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CREDENTIAL_ASSIGNABLE_STATEMENT } from '@snapflow/organization-access';
import {
	type OrganizationPermission,
	toOrganizationPermission,
} from './organization-permission.ts';
import { permissionKey, resourceLabel } from './organization-resources.ts';

export const API_KEY_NAME_MAX_LENGTH = 64;

export interface ApiKeyScopeOption {
	label: string;
	permission: OrganizationPermission;
	value: string;
}

export const API_KEY_SCOPE_OPTIONS: readonly ApiKeyScopeOption[] =
	Object.entries(CREDENTIAL_ASSIGNABLE_STATEMENT).flatMap(
		([resource, actions]) =>
			actions.flatMap((action) => {
				const permission = toOrganizationPermission(resource, action);
				return permission
					? [
							{
								label: `${resourceLabel(resource)}: ${action}`,
								permission,
								value: permissionKey(resource, action),
							},
						]
					: [];
			})
	);
