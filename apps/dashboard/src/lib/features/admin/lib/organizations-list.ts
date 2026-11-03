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

export const ORGANIZATION_SORT_OPTIONS = [
	{ id: 'name', label: 'Name' },
	{ id: 'members', label: 'Members' },
	{ id: 'credit', label: 'Credit' },
	{ id: 'created', label: 'Created' },
] as const;

export const ORGANIZATION_TYPE_LABELS = {
	personal: 'Personal',
	team: 'Team',
} as const;

export const ORGANIZATION_STATUS_LABELS = {
	active: 'Active',
	suspended: 'Suspended',
	deleted: 'Deleted',
} as const;

export const ORGANIZATION_FILTER_KEYS = ['type', 'status'] as const;

export const organizationsSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['name', 'members', 'credit', 'created']),
	type: adminFilterField(['personal', 'team']),
	status: adminFilterField(['active', 'suspended', 'deleted']),
});
