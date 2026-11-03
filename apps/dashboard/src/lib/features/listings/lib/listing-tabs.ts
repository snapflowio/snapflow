/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResourceTab } from '#lib/components/resource/resource-tabs.svelte';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

const TRAILING_SLASH = /\/$/;

function samePath(left: string, right: string): boolean {
	return left.replace(TRAILING_SLASH, '') === right.replace(TRAILING_SLASH, '');
}

export function listingTabs(
	pathname: string,
	canReadMine: boolean
): ResourceTab[] {
	return [
		{ label: 'Browse', path: Path.LISTINGS, visible: true },
		{ label: 'My listings', path: Path.LISTINGS_MINE, visible: canReadMine },
	]
		.filter((tab) => tab.visible)
		.map((tab) => {
			const href = resolve(tab.path);
			return { active: samePath(pathname, href), href, label: tab.label };
		});
}
