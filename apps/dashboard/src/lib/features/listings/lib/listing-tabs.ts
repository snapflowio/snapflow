/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResourceTab } from '#lib/components/resource/resource-tabs.svelte';
import { resolve } from '$app/paths';

const LISTING_TABS = [
	{ label: 'Overview', route: '/(app)/(dashboard)/listings/[machineId]' },
	{
		label: 'Benchmarks',
		route: '/(app)/(dashboard)/listings/[machineId]/benchmarks',
	},
	{
		label: 'Reliability',
		route: '/(app)/(dashboard)/listings/[machineId]/reliability',
	},
] as const;

export function listingDetailTabs(
	machineId: string,
	routeId: string | null,
	search: string
): ResourceTab[] {
	return LISTING_TABS.map((tab) => ({
		label: tab.label,
		active: routeId === tab.route,
		href: `${resolve(tab.route, { machineId })}${search}`,
	}));
}
