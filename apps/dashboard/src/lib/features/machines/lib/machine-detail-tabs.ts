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

const TABS = [
	{ label: 'Overview', route: '/(app)/(dashboard)/machines/[machineId]' },
	{ label: 'Trust', route: '/(app)/(dashboard)/machines/[machineId]/trust' },
	{
		label: 'Software',
		route: '/(app)/(dashboard)/machines/[machineId]/software',
	},
] as const;

export function machineDetailTabs(
	machineId: string,
	routeId: string | null
): ResourceTab[] {
	return TABS.map((tab) => ({
		active: routeId === tab.route,
		href: resolve(tab.route, { machineId }),
		label: tab.label,
	}));
}
