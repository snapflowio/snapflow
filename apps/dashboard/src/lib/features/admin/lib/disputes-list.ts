/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DisputeState } from '@snapflow/api-client';
import * as z from 'zod';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { titleCase } from '#lib/utils/text.ts';

export const DISPUTE_SORT_OPTIONS = [
	{ id: 'amount', label: 'Amount' },
	{ id: 'evidenceDue', label: 'Evidence due' },
	{ id: 'created', label: 'Opened' },
] as const;

export const DISPUTE_STATE_OPTIONS = Object.values(DisputeState).map(
	(state) => ({
		label: titleCase(state),
		value: state,
	})
);

export const DISPUTE_FILTER_KEYS = ['state'] as const;

export const disputesSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['amount', 'evidenceDue', 'created']),
	state: searchParamArray(z.enum(DisputeState)).catch([]),
});
