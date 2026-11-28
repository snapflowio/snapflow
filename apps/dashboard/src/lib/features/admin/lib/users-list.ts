/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	AdminUserSortField,
	AdminUserStatus,
	SystemRole,
} from '@snapflow/api-client';
import * as z from 'zod';
import {
	adminSearchField,
	adminSortFields,
	type SortColumn,
} from '#lib/features/admin/lib/admin-list.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';

export const USER_SORT_OPTIONS = [
	{ id: 'name', label: 'Name' },
	{ id: 'created', label: 'Joined' },
] as const;

export const USER_SORT_FIELDS = {
	name: AdminUserSortField.Name,
	created: AdminUserSortField.CreatedAt,
} as const satisfies Record<
	SortColumn<typeof USER_SORT_OPTIONS>,
	AdminUserSortField
>;

export const USER_ROLE_LABELS = {
	[SystemRole.Admin]: 'Admin',
	[SystemRole.User]: 'User',
} as const satisfies Record<SystemRole, string>;

export const USER_STATUS_LABELS = {
	[AdminUserStatus.Active]: 'Active',
	[AdminUserStatus.Banned]: 'Banned',
} as const satisfies Record<AdminUserStatus, string>;

export const USER_FILTER_KEYS = ['role', 'status'] as const;

export const USER_PANEL_PARAM = 'user';

export const usersSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['name', 'created']),
	role: searchParamArray(z.enum(SystemRole)).catch([]),
	status: searchParamArray(z.enum(AdminUserStatus)).catch([]),
	user: z.string().optional().catch(undefined),
});
