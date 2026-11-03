/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';
import {
	adminFilterField,
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';

export const USER_SORT_OPTIONS = [
	{ id: 'name', label: 'Name' },
	{ id: 'created', label: 'Joined' },
] as const;

export const USER_ROLE_LABELS = { admin: 'Admin', user: 'User' } as const;

export const USER_STATUS_LABELS = {
	active: 'Active',
	banned: 'Banned',
} as const;

export const USER_FILTER_KEYS = ['role', 'status'] as const;

export const usersSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['name', 'created']),
	role: adminFilterField(['admin', 'user']),
	status: adminFilterField(['active', 'banned']),
	user: z.string().optional().catch(undefined),
});
