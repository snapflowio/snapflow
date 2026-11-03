/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BillingOverviewDto } from '@snapflow/api-client';

const BASIS_POINTS_PER_PERCENT = 100;
const MAXIMUM_PERCENT = 100;

type AdmissionBlocker = BillingOverviewDto['admissionBlockers'][number];
type FundingState = BillingOverviewDto['funding']['state'];

function notice<const Tone extends 'default' | 'warning' | 'error'>(
	tone: Tone,
	title: string,
	description: string,
	offersSpendControls = false
) {
	return { tone, title, description, offersSpendControls } as const;
}

type BillingNotice = ReturnType<typeof notice>;

const ADMISSION_BLOCKER_NOTICES = [
	[
		'monthly_budget_exhausted',
		notice(
			'error',
			'Monthly spend limit reached',
			'Increase the limit before starting new billable workloads.',
			true
		),
	],
	[
		'network_budget_exhausted',
		notice(
			'error',
			'Network spend limit reached',
			'Increase the network limit before starting new billable workloads.',
			true
		),
	],
	[
		'funding_exhausted',
		notice(
			'error',
			'Credit is exhausted',
			'New billable workloads are paused until credit is added. Running workloads follow the configured billing cutoff.'
		),
	],
	[
		'funding_required',
		notice(
			'default',
			'Credit required',
			'Your account needs credit before starting billable workloads.'
		),
	],
] as const satisfies readonly (readonly [AdmissionBlocker, BillingNotice])[];

const FUNDING_STATE_NOTICES = {
	healthy: null,
	warning: notice(
		'warning',
		'Credit is running low',
		'Reduce active usage to preserve your desired funding runway.'
	),
	restricted: notice(
		'error',
		'New sandbox placements are blocked',
		'Credit or a spend limit is exhausted. Running sandboxes are not deleted.',
		true
	),
} as const satisfies Record<FundingState, BillingNotice | null>;

export function billingOverviewNotice(
	overview: BillingOverviewDto
): BillingNotice | null {
	const blockers = new Set(overview.admissionBlockers);
	const blockerNotice = ADMISSION_BLOCKER_NOTICES.find(([blocker]) =>
		blockers.has(blocker)
	);
	return blockerNotice?.[1] ?? FUNDING_STATE_NOTICES[overview.funding.state];
}

export function hasActiveBurn(funding: BillingOverviewDto['funding']): boolean {
	return BigInt(funding.currentBurnMicroUsdPerHour) > 0n;
}

export function budgetUsedPercent(
	month: BillingOverviewDto['month']
): number | null {
	if (month.utilizationBasisPoints === undefined) return null;
	return Math.min(
		MAXIMUM_PERCENT,
		Math.round(month.utilizationBasisPoints / BASIS_POINTS_PER_PERCENT)
	);
}
