/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const chipFilledFillTokens = 'bg-surface-4';
const chipFilledSurfaceTokens = `border border-border ${chipFilledFillTokens}`;
export const chipPrimaryFillTokens = 'bg-brand text-(--text-on-brand)';
export const chipRadiusClass = 'rounded-lg';
export const chipFieldSurfaceClass = `${chipRadiusClass} ${chipFilledSurfaceTokens} transition-colors`;
export const chipBorderShadowRing = 'shadow-raised';
export const chipFieldTextClass =
	'text-(--text-body) text-sm tracking-[inherit] outline-none placeholder:text-(--text-muted)';
export const chipContentGap = 'gap-1.5';
export const chipGeometryUnroundedClass = `h-7.5 items-center ${chipContentGap} px-2 text-left text-sm`;
export const chipGeometryClass = `${chipGeometryUnroundedClass} ${chipRadiusClass}`;
export const chipContentIconClass = 'size-4 shrink-0 text-(--text-icon)';
export const chipContentLabelClass =
	'min-w-0 overflow-hidden text-clip whitespace-nowrap text-(--text-body) text-sm';
export const chipHoverSurfaceClass = 'hover-hover:bg-surface-hover';
export const chipFocusSurfaceClass = 'focus-visible:bg-surface-hover';
export const chipActiveSurfaceClass = 'bg-surface-active';
export const chipDropTargetSurfaceClass = `${chipActiveSurfaceClass} outline outline-1 outline-(--text-subtle) -outline-offset-1`;
export const disclosureChevronClass =
	'size-3.5 shrink-0 text-(--text-icon) transition-[opacity,transform] duration-150';
export const chipIconSlotClass =
	'inline-flex size-4 shrink-0 items-center justify-center';
export const cellIconNodeClass =
	'inline-flex shrink-0 items-center text-(--text-icon) [&>svg]:size-3.5 [&>img]:size-3.5 [&>span]:size-3.5';
export const TRIGGER_BORDER_CLASS = 'border border-border';

export const MOBILE_TOUCH_TARGET_CLASS =
	'max-md:pointer-coarse:min-h-11 max-md:pointer-coarse:min-w-11';

export const MENU_SURFACE_CLASS =
	'rounded-xl border border-border bg-bg p-1 text-(--text-body) shadow-medium';
export const POPOVER_SURFACE_CLASS =
	'rounded-xl border border-border bg-bg text-(--text-body) shadow-xs';
export const TOOLTIP_SURFACE_CLASS =
	'w-fit max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-border bg-bg text-(--text-body) text-caption shadow-xs';
export const DOUBLE_FRAME_OUTER_CLASS =
	'rounded-xl border border-border bg-surface-5 p-0.75';
export const DOUBLE_FRAME_INNER_CLASS =
	'overflow-hidden rounded-lg border border-border bg-bg';

export const POPOVER_ANIMATION_CLASS =
	'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:animate-none';

export const SEGMENTED_TRACK_CLASS = `inline-flex w-fit max-w-full ${chipGeometryClass} ${chipFilledFillTokens} gap-0 overflow-x-auto p-0.5 scrollbar-none`;
export const SEGMENTED_ITEM_CLASS =
	'inline-flex h-full shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-sm outline-none transition-colors disabled:cursor-not-allowed';
export const SEGMENTED_ITEM_ACTIVE_CLASS = 'bg-surface-6 text-(--text-body)';
export const SEGMENTED_ITEM_INACTIVE_CLASS =
	'text-(--text-muted) hover-hover:text-(--text-body)';

export const PAGE_HEADER_BAR_CLASS =
	'flex shrink-0 flex-wrap items-center gap-y-2 bg-bg px-4 py-[8.5px] md:flex-nowrap';
export const RESOURCE_HEADER_BAR_CLASS =
	'flex min-h-12 shrink-0 items-center border-border border-b bg-bg px-4 py-[8.5px]';
export const HEADER_ACTION_CLUSTER_CLASS =
	'flex min-h-7.5 flex-wrap items-center justify-end gap-1 md:h-7.5 md:flex-nowrap';
export const PAGE_SCROLL_CLASS =
	'min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[env(safe-area-inset-bottom)] md:px-6 md:scrollbar-gutter-both';
export const PAGE_COLUMN_CLASS =
	'mx-auto flex w-full max-w-(--column-width) flex-col gap-7 pb-6';
export const PAGE_HEADING_CLASS =
	'text-balance font-heading text-[26px] text-(--text-primary) leading-[1.15] tracking-[-0.01em] sm:text-[28px]';
export const IDENTITY_TILE_CLASS =
	'inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-surface-6 text-(--text-primary) text-micro uppercase leading-none';
export const RESOURCE_TILE_CLASS =
	'flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-5 text-(--text-icon) [&_svg]:size-5';
