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

const OVERVIEW_TAB_ROUTE = '/(app)/(dashboard)/sandboxes/[sandboxId]';
const TABS = [
	{
		label: 'Overview',
		route: OVERVIEW_TAB_ROUTE,
		requiresWrite: false,
		compactOnly: true,
	},
	{
		label: 'Terminal',
		route: '/(app)/(dashboard)/sandboxes/[sandboxId]/terminal',
		requiresWrite: true,
		compactOnly: false,
	},
	{
		label: 'Files',
		route: '/(app)/(dashboard)/sandboxes/[sandboxId]/files',
		requiresWrite: true,
		compactOnly: false,
	},
	{
		label: 'Desktop',
		route: '/(app)/(dashboard)/sandboxes/[sandboxId]/desktop',
		requiresWrite: true,
		compactOnly: false,
	},
	{
		label: 'Networking',
		route: '/(app)/(dashboard)/sandboxes/[sandboxId]/networking',
		requiresWrite: false,
		compactOnly: false,
	},
	{
		label: 'Usage',
		route: '/(app)/(dashboard)/sandboxes/[sandboxId]/usage',
		requiresWrite: false,
		compactOnly: false,
	},
	{
		label: 'Recovery',
		route: '/(app)/(dashboard)/sandboxes/[sandboxId]/recovery',
		requiresWrite: false,
		compactOnly: false,
	},
] as const;
const ROUTE_SEPARATOR = '/';

type SandboxDetailTab = (typeof TABS)[number];

function isActiveRoute(routeId: string | null, tabRoute: string): boolean {
	if (routeId === tabRoute) return true;
	return (
		tabRoute !== OVERVIEW_TAB_ROUTE &&
		Boolean(routeId?.startsWith(`${tabRoute}${ROUTE_SEPARATOR}`))
	);
}

function visibleTabs(canWrite: boolean, wide: boolean): SandboxDetailTab[] {
	return TABS.filter(
		(tab) => (canWrite || !tab.requiresWrite) && !(wide && tab.compactOnly)
	);
}

export function sandboxDetailTabs(
	sandboxId: string,
	canWrite: boolean,
	wide: boolean,
	routeId: string | null
): ResourceTab[] {
	return visibleTabs(canWrite, wide).map((tab) => ({
		active: isActiveRoute(routeId, tab.route),
		href: resolve(tab.route, { sandboxId }),
		label: tab.label,
	}));
}

export function firstSandboxContentTabHref(
	sandboxId: string,
	canWrite: boolean
): string {
	const [first] = visibleTabs(canWrite, true);
	return resolve(first?.route ?? OVERVIEW_TAB_ROUTE, { sandboxId });
}
