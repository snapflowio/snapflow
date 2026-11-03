/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SIDEBAR_WIDTH = {
	DEFAULT: 224,
	MIN: 224,
	MAX: 400,
	MAX_VIEWPORT_RATIO: 0.3,
	COLLAPSED: 48,
} as const;

export const SIDEBAR_COLLAPSED_COOKIE = 'sidebar_collapsed';
export const SIDEBAR_COOKIE_MAX_AGE_SECONDS = 31_536_000;
export const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar-state';

export const SIDEBAR_SECTION_GAP_CLASS = 'mt-4';
export const SIDEBAR_COLLAPSED_SECTION_GAP_CLASS = 'mt-2';
export const SIDEBAR_ITEM_GAP_CLASS = 'gap-px';
export const SIDEBAR_DIVIDER_PAD_ABOVE_CLASS = 'pb-2';
export const SIDEBAR_DIVIDER_PAD_BELOW_CLASS = 'pt-2';
export const SIDEBAR_RAIL_CHIP_CLASS = 'group-data-collapsed/rail:w-8';
export const SIDEBAR_FLYOUT_CLOSE_DELAY_MS = 150;
export const SIDEBAR_FLYOUT_WIDTH_CLASS = 'w-55';
export const SIDEBAR_FLYOUT_SIDE_OFFSET = 8;

export function maximumSidebarWidth(viewportWidth: number): number {
	return Math.max(
		SIDEBAR_WIDTH.MIN,
		Math.min(
			SIDEBAR_WIDTH.MAX,
			viewportWidth * SIDEBAR_WIDTH.MAX_VIEWPORT_RATIO
		)
	);
}

export function clampSidebarWidth(
	width: number,
	viewportWidth: number
): number {
	if (!Number.isFinite(width)) return SIDEBAR_WIDTH.DEFAULT;
	return Math.min(
		Math.max(width, SIDEBAR_WIDTH.MIN),
		maximumSidebarWidth(viewportWidth)
	);
}
