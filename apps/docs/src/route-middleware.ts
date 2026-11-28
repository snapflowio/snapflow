/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	defineRouteMiddleware,
	type StarlightRouteData,
} from '@astrojs/starlight/route-data';
import { SECTION_SIDEBAR_GROUPS, sectionForPath } from './config/sections';

type SidebarEntry = StarlightRouteData['sidebar'][number];
type SidebarLink = Extract<SidebarEntry, { type: 'link' }>;
type Pagination = StarlightRouteData['pagination'];

function sectionSidebar(
	sidebar: readonly SidebarEntry[],
	sidebarGroup: string | undefined
): SidebarEntry[] {
	if (sidebarGroup === undefined) {
		return sidebar.filter(
			(entry) =>
				entry.type !== 'group' || !SECTION_SIDEBAR_GROUPS.has(entry.label)
		);
	}
	return sidebar.flatMap((entry) =>
		entry.type === 'group' && entry.label === sidebarGroup ? entry.entries : []
	);
}

function links(sidebar: readonly SidebarEntry[]): SidebarLink[] {
	return sidebar.flatMap((entry) =>
		entry.type === 'group' ? links(entry.entries) : [entry]
	);
}

type PaginationSetting = StarlightRouteData['entry']['data']['prev'];

function neighbour(
	setting: PaginationSetting,
	sectionLinks: readonly SidebarLink[],
	index: number,
	authored: SidebarLink | undefined
): SidebarLink | undefined {
	if (setting === false) {
		return undefined;
	}
	if (setting === undefined || setting === true) {
		return index >= 0 ? sectionLinks[index] : undefined;
	}
	return authored;
}

function sectionPagination(
	sidebar: readonly SidebarEntry[],
	current: Pagination,
	data: StarlightRouteData['entry']['data']
): Pagination {
	const sectionLinks = links(sidebar);
	const index = sectionLinks.findIndex(({ isCurrent }) => isCurrent);
	if (index === -1) {
		return current;
	}
	return {
		prev: neighbour(data.prev, sectionLinks, index - 1, current.prev),
		next: neighbour(data.next, sectionLinks, index + 1, current.next),
	};
}

export const onRequest = defineRouteMiddleware(async (context, next) => {
	await next();
	const route = context.locals.starlightRoute;
	const section = sectionForPath(context.url.pathname);
	route.sidebar = sectionSidebar(route.sidebar, section.sidebarGroup);
	route.pagination = sectionPagination(
		route.sidebar,
		route.pagination,
		route.entry.data
	);
});
