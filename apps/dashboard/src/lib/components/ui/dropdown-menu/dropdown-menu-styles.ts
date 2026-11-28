/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	chipContentGap,
	MENU_SURFACE_CLASS,
	POPOVER_ANIMATION_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';

export const MENU_ROW_HEIGHT_CLASS = 'h-7';
export const MENU_SIDE_OFFSET = 6;
export const MENU_ROW_SIZES = {
	sm: 'h-7 text-xs',
	md: 'h-7 text-[13px]',
	lg: 'h-8 text-sm',
} as const;
export type MenuRowSize = keyof typeof MENU_ROW_SIZES;

export const MENU_ROW_HIGHLIGHT_CLASS =
	'data-highlighted:bg-surface-5 group-focus-within/dropdownitem:bg-surface-5 group-hover/dropdownitem:bg-surface-5';
export const MENU_ROW_SELECTED_CLASS =
	'bg-surface-5 data-highlighted:bg-surface-5';
export const MENU_ROW_CHECKED_CLASS =
	'data-[state=checked]:text-(--text-primary)';
const MENU_ROW_SINGLE_LINE_CLASS =
	'whitespace-nowrap [&>span]:min-w-0 [&>span]:truncate';
export const MENU_ROW_BASE_CLASS = `relative flex min-w-0 cursor-pointer select-none items-center ${chipContentGap} rounded-md px-2 text-(--text-primary) outline-none transition-colors duration-(--motion-instant) data-disabled:pointer-events-none data-disabled:opacity-50 ${MENU_ROW_SINGLE_LINE_CLASS} [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-(--text-muted)`;
export const dropdownMenuRowClass = `${MENU_ROW_BASE_CLASS} ${MENU_ROW_SIZES.md}`;
export const MENU_LABEL_CLASS = 'min-w-0 truncate';
export const MENU_HEADING_CLASS = `flex ${MENU_ROW_HEIGHT_CLASS} items-center px-2 font-medium text-(--text-subtle) text-xs`;
export const MENU_SEPARATOR_CLASS = '-mx-1.5 my-1.5 border-border border-t';
export const MENU_SHORTCUT_CLASS = 'ml-auto shrink-0 pl-3';
export const MENU_CONTENT_CLASS = `${POPOVER_ANIMATION_CLASS} ${MENU_SURFACE_CLASS} z-(--z-popover) min-w-32 overflow-y-auto overflow-x-hidden overscroll-none outline-none focus-visible:outline-none`;
export const MENU_ROOT_MAX_WIDTH_CLASS = 'max-w-64';
export const MENU_SUB_MAX_WIDTH_CLASS = 'max-w-70';
export const MENU_MAX_HEIGHT_CLASS =
	'max-h-[min(420px,var(--bits-dropdown-menu-content-available-height,420px))]';
export const MENU_TRANSFORM_ORIGIN_CLASS =
	'origin-(--bits-dropdown-menu-content-transform-origin)';
export const MENU_TRAILING_ICON_CLASS = 'ml-auto';
