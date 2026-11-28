/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';
import type { ResourceSegment } from '#lib/components/resource/resource-options.ts';
import type { SearchParamsValues } from '#lib/routing/search-params.ts';

export const EarningsView = {
	Machines: 'machines',
	Payouts: 'payouts',
} as const;

export type EarningsView = (typeof EarningsView)[keyof typeof EarningsView];

export const EARNINGS_SEGMENTS: readonly ResourceSegment<EarningsView>[] = [
	{ value: EarningsView.Payouts, label: 'Payouts' },
	{ value: EarningsView.Machines, label: 'Machines' },
];

export const EARNINGS_PANEL_PARAM = 'id';

export const earningsSearchSchema = z.object({
	view: z.enum(EarningsView).catch(EarningsView.Payouts),
	machine: z.string().nullable().catch(null),
});

export type EarningsParams = SearchParamsValues<typeof earningsSearchSchema>;

export function isEarningsView(value: string): value is EarningsView {
	return Object.values<string>(EarningsView).includes(value);
}
