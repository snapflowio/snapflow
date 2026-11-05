/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint } from 'better-auth/api';
import {
	hasPermission,
	type OrganizationOptions,
} from 'better-auth/plugins/organization';
import * as z from 'zod';
import {
	type PermissionPair,
	permissionPairs,
	toPermissionRecord,
} from '../utils/organization-permissions.util';

const ORGANIZATION_ACCESS_PLUGIN_ID = 'organization-access';

const permissionCheckBody = z.object({
	organizationId: z.string(),
	role: z.string(),
	permissions: z.record(z.string(), z.array(z.string())),
});

export function organizationAccess(options: OrganizationOptions) {
	return {
		id: ORGANIZATION_ACCESS_PLUGIN_ID,
		endpoints: {
			checkOrganizationPermissions: createAuthEndpoint.serverOnly(
				{ method: 'POST', body: permissionCheckBody },
				async (ctx) => {
					const { organizationId, role, permissions } = ctx.body;
					const granted: PermissionPair[] = [];
					for (const pair of permissionPairs(permissions)) {
						const allowed = await hasPermission(
							{
								role,
								options,
								organizationId,
								permissions: { [pair.resource]: [pair.action] },
							},
							ctx
						);
						if (allowed) granted.push(pair);
					}
					return ctx.json({ permissions: toPermissionRecord(granted) });
				}
			),
		},
	} satisfies BetterAuthPlugin;
}
