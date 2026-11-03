/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Payout, PayoutState } from '@snapflow/api-client';
import * as z from 'zod';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { titleCase } from '#lib/utils/text.ts';

const RETRYABLE_STATES: ReadonlySet<PayoutState> = new Set([
	PayoutState.Pending,
	PayoutState.Failed,
]);

export const PAYOUT_SORT_OPTIONS = [
	{ id: 'amount', label: 'Amount' },
	{ id: 'created', label: 'Created' },
	{ id: 'transferred', label: 'Transferred' },
] as const;

export const PAYOUT_STATE_OPTIONS = Object.values(PayoutState).map((state) => ({
	label: titleCase(state),
	value: state,
}));

export const PAYOUT_FILTER_KEYS = ['state'] as const;

export const payoutsSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['amount', 'created', 'transferred']),
	state: searchParamArray(z.enum(PayoutState)).catch([]),
});

export function isRetryable(payout: Payout): boolean {
	return RETRYABLE_STATES.has(payout.state);
}
