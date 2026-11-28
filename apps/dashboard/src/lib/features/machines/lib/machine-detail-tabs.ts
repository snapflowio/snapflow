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

const COMPLAINTS_ROUTE = '/(app)/(dashboard)/machines/[machineId]/complaints';
const LISTING_ROUTE = '/(app)/(dashboard)/machines/[machineId]/listing';

const TABS = [
	{ label: 'Overview', route: '/(app)/(dashboard)/machines/[machineId]' },
	{ label: 'Listing', route: LISTING_ROUTE },
	{ label: 'Health', route: '/(app)/(dashboard)/machines/[machineId]/health' },
	{
		label: 'Software',
		route: '/(app)/(dashboard)/machines/[machineId]/software',
	},
	{ label: 'Trust', route: '/(app)/(dashboard)/machines/[machineId]/trust' },
	{ label: 'Complaints', route: COMPLAINTS_ROUTE },
	{
		label: 'Settings',
		route: '/(app)/(dashboard)/machines/[machineId]/settings',
	},
] as const;

export interface MachineTabOptions {
	routeId: string | null;
	complaints: number | undefined;
	showsListing: boolean;
}

export function machineDetailTabs(
	machineId: string,
	{ routeId, complaints, showsListing }: MachineTabOptions
): ResourceTab[] {
	return TABS.map((tab) => ({
		active: routeId === tab.route,
		href: resolve(tab.route, { machineId }),
		label: tab.label,
		count:
			tab.route === COMPLAINTS_ROUTE && complaints ? complaints : undefined,
		visible: tab.route === LISTING_ROUTE ? showsListing : undefined,
	}));
}
