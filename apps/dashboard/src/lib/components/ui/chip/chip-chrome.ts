/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const chipFilledFillTokens =
	'bg-surface-5 text-(--text-primary) border border-white/5';
export const chipPrimaryFillTokens =
	'bg-(--accent-fill) text-(--text-on-accent) hover-hover:bg-(--accent-fill-hover)';
export const chipRadiusClass = 'rounded-full';
export const fieldRadiusClass = 'rounded-xl';
export const chipFieldSurfaceClass = `${fieldRadiusClass} border border-border bg-surface-3 shadow-(--shadow-subtle) transition-[border-color,box-shadow,background-color] duration-(--motion-quick)`;
export const DISABLED_CLASS = 'opacity-50';
export const DISABLED_STATE_CLASS =
	'disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';
export const chipOpenSurfaceClass = 'data-[state=open]:bg-surface-5';
export const chipFieldTextClass =
	'text-(--text-primary) text-base md:text-sm tracking-[inherit] outline-none placeholder:text-(--text-subtle)';
export const chipContentGap = 'gap-2';
export const chipGeometryUnroundedClass = `h-10 items-center justify-center ${chipContentGap} px-5 text-sm font-[550] tracking-[0.01em] whitespace-nowrap select-none`;
export const chipContentIconClass = 'size-4 shrink-0 text-current';
export const chipContentLabelClass =
	'min-w-0 overflow-hidden text-clip whitespace-nowrap text-current';
export const chipHoverSurfaceClass = 'hover-hover:bg-surface-5';
export const FOCUS_RING_INSET_CLASS = 'focus-visible:focus-ring-inset';
export const FOCUS_RING_CLASS = 'focus-visible:focus-ring';
export const chipActiveSurfaceClass =
	'bg-surface-5 text-(--text-primary) cursor-default hover-hover:bg-surface-5';
export const disclosureChevronClass =
	'size-4 shrink-0 text-(--text-subtle) transition-[opacity,transform] duration-(--motion-quick) ease-out';
export const chipIconSlotClass =
	'inline-flex size-4 shrink-0 items-center justify-center';
export const cellIconNodeClass =
	'inline-flex shrink-0 items-center text-(--text-icon) [&>svg]:size-4 [&>img]:size-4 [&>span]:size-4';

export const MOBILE_TOUCH_TARGET_CLASS =
	'max-md:pointer-coarse:min-h-11 max-md:pointer-coarse:min-w-11';

export const MENU_SURFACE_CLASS =
	'rounded-xl border border-border bg-surface-3 p-1.5 text-(--text-body) text-[13px] shadow-(--shadow-overlay)';
export const POPOVER_SURFACE_CLASS =
	'rounded-xl border border-border bg-surface-1 text-(--text-body) shadow-(--shadow-medium)';
export const TOOLTIP_SURFACE_CLASS =
	'w-fit max-w-[min(20rem,calc(100vw-2rem))] rounded-md border border-border bg-surface-1 px-3 py-1.5 text-(--text-body) text-sm shadow-(--shadow-medium)';
export const DOUBLE_FRAME_OUTER_CLASS =
	'rounded-3xl border border-(--border-subtle) bg-bg p-1';
export const DOUBLE_FRAME_INNER_CLASS =
	'overflow-hidden rounded-[20px] bg-surface-1';

export const POPOVER_ANIMATION_CLASS =
	'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in duration-(--motion-quick) ease-out motion-reduce:animate-none';

export const SEGMENTED_TRACK_CLASS =
	'inline-flex w-fit max-w-full shrink-0 items-center gap-x-1 overflow-x-auto rounded-full bg-surface-3 p-1 scrollbar-none';
export const SEGMENTED_ITEM_CLASS = `inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-xs outline-none transition-colors duration-(--motion-quick) ${FOCUS_RING_INSET_CLASS} disabled:cursor-not-allowed disabled:opacity-50`;
export const SEGMENTED_ITEM_ACTIVE_CLASS = 'text-(--text-primary)';
export const SEGMENTED_ITEM_INACTIVE_CLASS =
	'text-(--text-subtle) hover-hover:text-(--text-primary)';

export const HEADER_ACTION_CLUSTER_CLASS =
	'flex flex-wrap items-center justify-start gap-2 md:flex-nowrap md:justify-end';
export const RESOURCE_TILE_CLASS =
	'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-1 text-(--text-subtle) text-[10px] ring-1 ring-white/10 ring-inset [&_svg]:size-4';
