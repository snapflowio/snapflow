/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export type PageWidth = 'page' | 'settings' | 'narrow' | 'wide';

export const PAGE_WIDTH_CLASS: Record<PageWidth, string> = {
	page: 'max-w-[1280px]',
	settings: 'max-w-[768px]',
	narrow: 'max-w-[640px]',
	wide: 'max-w-none',
};

export const PAGE_BODY_SCROLL_CLASS =
	'relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-4 pb-[env(safe-area-inset-bottom)] scrollbar-gutter-stable md:px-8';

export const PAGE_BODY_EMBEDDED_CLASS =
	'relative flex flex-col items-center px-4 pb-[env(safe-area-inset-bottom)] md:px-8';

export const PAGE_CARD_SCROLL_CLASS =
	'flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain scrollbar-gutter-stable';

export const PAGE_BODY_COLUMN_CLASS = 'flex w-full flex-col gap-8 pt-8';

export const PAGE_BODY_CONTENT_CLASS = 'flex w-full flex-col pb-8';

export const PAGE_HEADER_ROW_CLASS =
	'relative flex flex-col items-start gap-y-4 md:min-h-10 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-4';

export const PAGE_TOOLBAR_CLASS =
	'relative flex min-h-14 shrink-0 items-center justify-between gap-4 border-border border-b px-4 py-3';

export const PAGE_TITLE_CLASS =
	'min-w-0 truncate whitespace-nowrap font-heading font-normal text-(--text-primary) text-2xl leading-8';

export const PAGE_DETAIL_TITLE_CLASS =
	'heading-xs min-w-0 truncate text-(--text-primary)';

export const PAGE_TOOLBAR_TITLE_CLASS =
	'min-w-0 whitespace-nowrap text-(--text-primary) text-sm';
