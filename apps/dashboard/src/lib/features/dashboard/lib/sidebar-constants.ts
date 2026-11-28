/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SIDEBAR_WIDTH = {
	DESKTOP: 224,
	COLLAPSED: 64,
	MOBILE: 288,
	HIDDEN: 0,
} as const;

export const SIDEBAR_OPEN_STORAGE_KEY = 'snapflow-sidebar-open';
export const SIDEBAR_COLLAPSIBLE = 'icon';
export const SIDEBAR_STATE = {
	EXPANDED: 'expanded',
	COLLAPSED: 'collapsed',
} as const;
export const SIDEBAR_SHORTCUT = ['mod', 'B'] as const;
export const SIDEBAR_KEYSHORTCUTS = 'Meta+B Control+B';
export const SIDEBAR_NAVIGATION_ID = 'app-navigation';

export const SIDEBAR_LIST_CLASS = 'flex w-full min-w-0 flex-col gap-1';
export const SIDEBAR_ITEM_CLASS =
	'flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden whitespace-nowrap rounded-lg border border-transparent px-2 text-left text-sm outline-none transition-colors duration-(--motion-quick) focus-visible:focus-ring-inset';
export const SIDEBAR_ITEM_IDLE_CLASS =
	'text-(--text-subtle) hover-hover:text-(--text-secondary)';
export const SIDEBAR_ITEM_ACTIVE_CLASS =
	'border-(--border-subtle) bg-surface-1 text-(--text-primary) shadow-xs';
export const SIDEBAR_ITEM_ICON_CLASS = 'size-[15px] shrink-0';
export const SIDEBAR_ITEM_LABEL_CLASS =
	'ml-2 min-w-0 flex-1 truncate font-medium';
export const SIDEBAR_COUNT_CLASS = 'in-data-[collapsible=icon]:hidden';
export const SIDEBAR_SUB_LIST_CLASS =
	'mx-3.5 my-2 flex min-w-0 translate-x-px flex-col gap-y-2 border-border border-l px-2.5 py-0.5 in-data-[collapsible=icon]:hidden';
export const SIDEBAR_SUB_ITEM_CLASS =
	'ml-4 inline-flex rounded-sm font-medium text-sm outline-none transition-colors duration-(--motion-quick) hover-hover:text-(--text-primary) focus-visible:focus-ring';
export const SIDEBAR_GROUP_LABEL_CLASS =
	'whitespace-nowrap px-2 font-medium text-(--text-subtle) text-xs transition-[margin,opacity] duration-(--motion-standard) ease-linear in-data-[collapsible=icon]:-mt-6 in-data-[collapsible=icon]:opacity-0';
export const SIDEBAR_FOOTER_LINK_CLASS =
	'flex h-8 min-w-0 cursor-pointer items-center gap-2 overflow-hidden whitespace-nowrap rounded-lg px-2 border border-transparent text-(--text-subtle) text-sm outline-none transition-colors duration-(--motion-quick) hover-hover:text-(--text-secondary) focus-visible:focus-ring';
export const SIDEBAR_FOOTER_ICON_CLASS = 'size-[15px] shrink-0';
export const SIDEBAR_FOOTER_LABEL_CLASS = 'ml-2 font-medium';
export const SIDEBAR_RAIL_CLASS =
	"absolute inset-y-0 -right-2 z-20 flex w-4 cursor-w-resize outline-none transition-all duration-(--motion-standard) ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:content-[''] hover-hover:after:bg-border data-[state=collapsed]:cursor-e-resize motion-reduce:transition-none";
export const SIDEBAR_MENU_ITEM_CLASS = '[&_svg]:size-4';
export const SIDEBAR_MENU_TRIGGER_CLASS = `${SIDEBAR_ITEM_CLASS} shrink-0 p-2 text-(--text-primary) hover-hover:bg-surface-1 data-[state=open]:bg-surface-1 in-data-[collapsible=icon]:px-0.75`;
export const SIDEBAR_MENU_CONTENT_CLASS =
	'max-h-(--bits-dropdown-menu-content-available-height) w-(--bits-dropdown-menu-anchor-width) min-w-56 max-w-[calc(100vw-24px)]';
export const SIDEBAR_MENU_ICON_SLOT_CLASS =
	'flex size-6 shrink-0 items-center justify-center';
export const SIDEBAR_AVATAR_CLASS =
	'relative flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 font-sans not-italic text-(--text-secondary) text-[10px] ring-1 ring-white/10 ring-inset';
export const ORG_SEARCH_THRESHOLD = 5;
