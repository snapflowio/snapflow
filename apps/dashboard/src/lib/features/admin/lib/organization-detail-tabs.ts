/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Snippet } from 'svelte';
import * as z from 'zod';
import type { ResourceCrumb } from '#lib/components/resource/resource-breadcrumbs.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import type { ResourceTab } from '#lib/components/resource/resource-tabs.svelte';

const TABS = [
	{ id: 'overview', label: 'Overview' },
	{ id: 'limits', label: 'Limits' },
	{ id: 'quotas', label: 'Quotas' },
	{ id: 'credit', label: 'Credit' },
] as const;

export type OrganizationTab = (typeof TABS)[number]['id'];

const DEFAULT_TAB: OrganizationTab = 'overview';

export const organizationDetailSearchSchema = z.object({
	tab: z.enum(['overview', 'limits', 'quotas', 'credit']).catch(DEFAULT_TAB),
});

export interface OrganizationDetailChrome {
	breadcrumbs: readonly ResourceCrumb[];
	crumbActions: readonly ResourceRowAction[];
	tabs: readonly ResourceTab[];
	status: Snippet;
}

export function organizationDetailTabs(
	pathname: string,
	active: OrganizationTab
): ResourceTab[] {
	return TABS.map((tab) => ({
		label: tab.label,
		href: tab.id === DEFAULT_TAB ? pathname : `${pathname}?tab=${tab.id}`,
		active: tab.id === active,
	}));
}
