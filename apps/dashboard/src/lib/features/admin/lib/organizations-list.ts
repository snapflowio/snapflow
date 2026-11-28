/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	AdminOrganizationSortField,
	AdminOrganizationStatus,
	AdminOrganizationType,
} from '@snapflow/api-client';
import * as z from 'zod';
import {
	adminSearchField,
	adminSortFields,
	type SortColumn,
} from '#lib/features/admin/lib/admin-list.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';

export const ORGANIZATION_SORT_OPTIONS = [
	{ id: 'name', label: 'Name' },
	{ id: 'created', label: 'Created' },
] as const;

export const ORGANIZATION_SORT_FIELDS = {
	name: AdminOrganizationSortField.Name,
	created: AdminOrganizationSortField.CreatedAt,
} as const satisfies Record<
	SortColumn<typeof ORGANIZATION_SORT_OPTIONS>,
	AdminOrganizationSortField
>;

export const ORGANIZATION_TYPE_LABELS = {
	[AdminOrganizationType.Personal]: 'Personal',
	[AdminOrganizationType.Team]: 'Team',
} as const satisfies Record<AdminOrganizationType, string>;

export const ORGANIZATION_STATUS_LABELS = {
	[AdminOrganizationStatus.Active]: 'Active',
	[AdminOrganizationStatus.Suspended]: 'Suspended',
	[AdminOrganizationStatus.Deleted]: 'Deleted',
} as const satisfies Record<AdminOrganizationStatus, string>;

export const ORGANIZATION_FILTER_KEYS = ['type', 'status'] as const;

export const organizationsSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['name', 'created']),
	type: searchParamArray(z.enum(AdminOrganizationType)).catch([]),
	status: searchParamArray(z.enum(AdminOrganizationStatus)).catch([]),
});
