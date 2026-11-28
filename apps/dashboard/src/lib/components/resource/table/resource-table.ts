/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ColumnVisibilityState } from '@tanstack/svelte-table';
import type { Snippet } from 'svelte';

export const EMPTY_CELL_PLACEHOLDER = '—';

export type ResourceColumnVariant = 'data' | 'actions' | 'selection';
export type ResourceColumnAlign = 'start' | 'end';

export type ResourceTableVariant = 'condensed' | 'framed';

export type ResourceTableBreakpoint = 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const RESOURCE_TABLE_BREAKPOINT_PX: Record<ResourceTableBreakpoint, number> = {
	md: 640,
	lg: 768,
	xl: 920,
	'2xl': 1024,
	'3xl': 1200,
};

export interface ResourceColumnMeta {
	variant?: ResourceColumnVariant;
	widthMultiplier?: number;
	width?: number;
	grow?: number;
	align?: ResourceColumnAlign;
	visibleFrom?: ResourceTableBreakpoint;
	compact?: boolean;
}

export interface ResourceColumnLayout extends ResourceColumnMeta {
	id: string;
}

export interface ResourceCell<TData = undefined> {
	icon?: Snippet<[TData]>;
	label?: string | null;
	sublabel?: string;
	content?: Snippet<[TData]>;
}

const ACTION_COLUMN_WIDTH = '3.5rem';
export const QUICK_ACTION_COLUMN_PX = 88;
const SELECTION_COLUMN_WIDTH = '3.25rem';
const FIRST_DATA_COLUMN_WEIGHT = 2.5;
const FIRST_DATA_COLUMN_MIN_WIDTH = '10rem';
const COMPACT_DATA_COLUMN_COUNT = 2;

export const resourceTableRowClass =
	"group/row group/row-actions relative grid w-full outline-none transition-colors duration-(--motion-quick) after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:content-['']";
export const resourceTableRowDimmedClass = 'opacity-40';

interface ResourceTableVariantClasses {
	frame: string;
	header: string;
	headerCell: string;
	rowLine: string;
	rowIdle: string;
	rowSelected: string;
	cell: string;
}

export const RESOURCE_TABLE_VARIANT: Record<
	ResourceTableVariant,
	ResourceTableVariantClasses
> = {
	condensed: {
		frame: '',
		header: 'grid border-border border-b bg-surface-1',
		headerCell: 'flex h-[38px] min-w-0 items-center py-2 text-left table-head',
		rowLine: 'after:bg-(--border-subtle)',
		rowIdle:
			'focus-visible:bg-surface-3/50 hover-hover:bg-surface-3/50 [&_td]:text-(--text-primary)',
		rowSelected: 'bg-surface-3 [&_td]:text-(--text-primary)',
		cell: 'flex min-h-11 min-w-0 items-center gap-2 text-sm md:min-h-(--space-row) md:py-0.5',
	},
	framed: {
		frame: 'rounded-2xl border border-border',
		header: 'grid border-border border-b bg-surface-3',
		headerCell: 'flex h-12 min-w-0 items-center text-left table-head',
		rowLine: 'after:bg-border last:after:hidden',
		rowIdle:
			'focus-visible:bg-surface-5/50 hover-hover:bg-surface-5/50 [&_td]:text-(--text-primary)',
		rowSelected: 'bg-surface-5 [&_td]:text-(--text-primary)',
		cell: 'flex min-h-[53px] min-w-0 items-center gap-2 py-4 text-sm',
	},
};

export const resourceTableHeaderClass = RESOURCE_TABLE_VARIANT.condensed.header;
export const resourceHeaderCellClass =
	RESOURCE_TABLE_VARIANT.condensed.headerCell;

export function resourceCellPaddingClass(
	layout: ResourceColumnLayout,
	variant: ResourceTableVariant = 'condensed'
): string {
	if (variant === 'framed') {
		if (layout.variant === 'actions') return 'justify-end px-2 last:pr-3';
		return layout.align === 'end'
			? 'justify-end px-4 text-right tabular-nums'
			: 'px-4';
	}
	if (layout.variant === 'actions') return 'justify-end px-2 last:pr-3';
	if (layout.align === 'end') {
		return 'justify-end px-2 text-right tabular-nums first:pl-4 last:pr-4';
	}
	return 'px-2 first:pl-4 last:pr-4';
}

function isDataColumn(layout: ResourceColumnLayout): boolean {
	return layout.variant !== 'actions' && layout.variant !== 'selection';
}

function columnTrack(
	layout: ResourceColumnLayout,
	isFirst: boolean,
	compact: boolean
): string {
	const fillsCompactRow = compact && isFirst;
	if (layout.width !== undefined && !fillsCompactRow) {
		return `${layout.width}px`;
	}
	if (layout.variant === 'actions') return ACTION_COLUMN_WIDTH;
	if (layout.variant === 'selection') return SELECTION_COLUMN_WIDTH;
	const minWidth = isFirst && !compact ? FIRST_DATA_COLUMN_MIN_WIDTH : '0';
	if (layout.grow !== undefined) {
		return `minmax(${minWidth}, ${layout.grow}fr)`;
	}
	const weight =
		(isFirst ? FIRST_DATA_COLUMN_WEIGHT : 1) * (layout.widthMultiplier ?? 1);
	return `minmax(${minWidth}, ${weight}fr)`;
}

export function buildGridTemplateColumns(
	layouts: readonly ResourceColumnLayout[],
	compact = false
): string {
	const firstDataColumnId = layouts.find(isDataColumn)?.id;
	return layouts
		.map((layout) =>
			columnTrack(layout, layout.id === firstDataColumnId, compact)
		)
		.join(' ');
}

function compactColumnVisibility(
	layouts: readonly ResourceColumnLayout[]
): ColumnVisibilityState {
	const dataColumns = layouts.filter(isDataColumn);
	const prioritized = dataColumns.filter(
		(layout, index) => index === 0 || layout.compact === true
	);
	const shown =
		prioritized.length > 1
			? prioritized
			: dataColumns.slice(0, COMPACT_DATA_COLUMN_COUNT);
	const hidden = layouts.filter(
		(layout) =>
			layout.variant === 'selection' ||
			(isDataColumn(layout) && !shown.includes(layout))
	);
	return Object.fromEntries(
		hidden.map((layout) => [layout.id, false] as const)
	);
}

function fitsTableWidth(
	layout: ResourceColumnLayout,
	tableWidth: number
): boolean {
	return (
		layout.visibleFrom === undefined ||
		tableWidth >= RESOURCE_TABLE_BREAKPOINT_PX[layout.visibleFrom]
	);
}

export function resourceColumnVisibility(
	layouts: readonly ResourceColumnLayout[],
	tableWidth: number,
	compact: boolean
): ColumnVisibilityState {
	if (compact) return compactColumnVisibility(layouts);
	return Object.fromEntries(
		layouts
			.filter((layout) => !fitsTableWidth(layout, tableWidth))
			.map((layout) => [layout.id, false] as const)
	);
}
