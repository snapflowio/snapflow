/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SDK_REFERENCE } from './sdk-reference';
import { DOCS_BASE } from './site';

export interface DocsSection {
	readonly id: string;
	readonly label: string;
	readonly href: string;
	readonly sidebarGroup?: string;
}

const GUIDES_SECTION: DocsSection = {
	id: 'guides',
	label: 'Guides',
	href: `${DOCS_BASE}/`,
};

const SDK_SECTION: DocsSection = {
	id: SDK_REFERENCE.output,
	label: SDK_REFERENCE.label,
	href: `${DOCS_BASE}/${SDK_REFERENCE.output}/`,
	sidebarGroup: SDK_REFERENCE.label,
};

export const DOCS_SECTIONS: readonly DocsSection[] = [
	GUIDES_SECTION,
	SDK_SECTION,
];

export const SECTION_SIDEBAR_GROUPS: ReadonlySet<string> = new Set(
	DOCS_SECTIONS.flatMap(({ sidebarGroup }) =>
		sidebarGroup ? [sidebarGroup] : []
	)
);

export function sectionForPath(pathname: string): DocsSection {
	return (
		DOCS_SECTIONS.find(
			({ href, sidebarGroup }) =>
				sidebarGroup !== undefined &&
				(pathname === href.slice(0, -1) || pathname.startsWith(href))
		) ?? GUIDES_SECTION
	);
}
