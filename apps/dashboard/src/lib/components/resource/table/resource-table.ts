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

export interface ResourceColumnMeta {
	variant?: ResourceColumnVariant;
	widthMultiplier?: number;
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
const SELECTION_COLUMN_WIDTH = '3.25rem';
const FIRST_DATA_COLUMN_WEIGHT = 2.5;
const COMPACT_DATA_COLUMN_COUNT = 2;

export const resourceTableHeaderClass = 'grid border-border border-b bg-bg';

export const resourceTableRowClass =
	'group/row-actions grid w-full outline-none transition-colors';
export const resourceTableRowIdleClass =
	'hover-hover:bg-surface-hover focus-visible:bg-surface-hover';
export const resourceTableRowSelectedClass = 'bg-surface-active';

export const resourceHeaderCellClass =
	'flex h-10 min-w-0 items-center py-1.5 text-left text-(--text-muted) text-small';

export const resourceCellClass =
	'flex min-h-11 min-w-0 items-center gap-1 text-sm md:min-h-0 md:py-2.5';

export function resourceCellPaddingClass(layout: ResourceColumnLayout): string {
	return layout.variant === 'actions' ? 'justify-center px-3' : 'px-3 md:px-6';
}

function isDataColumn(layout: ResourceColumnLayout): boolean {
	return layout.variant !== 'actions' && layout.variant !== 'selection';
}

export function buildGridTemplateColumns(
	layouts: readonly ResourceColumnLayout[]
): string {
	const firstDataColumnId = layouts.find(isDataColumn)?.id;
	return layouts
		.map((layout) => {
			if (layout.variant === 'actions') return ACTION_COLUMN_WIDTH;
			if (layout.variant === 'selection') return SELECTION_COLUMN_WIDTH;
			const weight =
				(layout.id === firstDataColumnId ? FIRST_DATA_COLUMN_WEIGHT : 1) *
				(layout.widthMultiplier ?? 1);
			return `minmax(0, ${weight}fr)`;
		})
		.join(' ');
}

export function compactColumnVisibility(
	layouts: readonly ResourceColumnLayout[]
): ColumnVisibilityState {
	const hiddenDataColumns = layouts
		.filter(isDataColumn)
		.slice(COMPACT_DATA_COLUMN_COUNT);
	return Object.fromEntries(
		hiddenDataColumns.map((layout) => [layout.id, false] as const)
	);
}
