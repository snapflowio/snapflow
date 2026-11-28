/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AbuseReportDetail } from '@snapflow/api-client';
import * as z from 'zod';
import type { ResourceTab } from '#lib/components/resource/resource-tabs.svelte';

const TAB_IDS = ['overview', 'case', 'evidence', 'history'] as const;

export type AbuseReportTab = (typeof TAB_IDS)[number];

const DEFAULT_TAB: AbuseReportTab = 'overview';

const TAB_LABELS = {
	overview: 'Overview',
	case: 'Case',
	evidence: 'Evidence',
	history: 'History',
} as const satisfies Record<AbuseReportTab, string>;

export const abuseReportDetailSearchSchema = z.object({
	tab: z.enum(TAB_IDS).catch(DEFAULT_TAB),
});

function tabCount(
	tab: AbuseReportTab,
	detail: AbuseReportDetail
): number | undefined {
	if (tab === 'evidence') return detail.evidence.length;
	if (tab === 'history') return detail.actions.length;
	return undefined;
}

export function abuseReportDetailTabs(
	pathname: string,
	active: AbuseReportTab,
	detail: AbuseReportDetail
): ResourceTab[] {
	return TAB_IDS.map((tab) => ({
		label: TAB_LABELS[tab],
		href: tab === DEFAULT_TAB ? pathname : `${pathname}?tab=${tab}`,
		active: tab === active,
		count: tabCount(tab, detail),
	}));
}
