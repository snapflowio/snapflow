/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Snippet } from 'svelte';
import type {
	ResourceSortDirection,
	ResourceSortState,
} from '#lib/components/resource/table/resource-table-sort.ts';

export const MENU_OFFSET_PX = 6;

export interface ResourceSearchConfig {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	ariaLabel?: string;
}

export interface ResourceFilterTag {
	label: string;
	onRemove: () => void;
}

interface ResourceFilterPopoverConfig {
	content: Snippet;
	active?: boolean;
}

interface ResourceFilterSidebarConfig {
	sidebarId: string;
	open: boolean;
	onToggle: () => void;
}

export type ResourceFilterConfig =
	| ResourceFilterPopoverConfig
	| ResourceFilterSidebarConfig;

export interface ResourceSortOption {
	id: string;
	label: string;
}

export interface ResourceSortConfig {
	options: readonly ResourceSortOption[];
	active: ResourceSortState | null;
	onSort: (column: string, direction: ResourceSortDirection) => void;
	onClear?: () => void;
}

export interface ResourceMenuControlProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

const DIRECTION_LABELS: Record<ResourceSortDirection, string> = {
	asc: 'ascending',
	desc: 'descending',
};

export function nextSortDirection(
	active: ResourceSortState | null,
	column: string
): ResourceSortDirection {
	return active?.column === column && active.direction === 'desc'
		? 'asc'
		: 'desc';
}

export function sortAriaLabel(
	option: ResourceSortOption,
	active: ResourceSortState | null
): string {
	if (active?.column !== option.id) {
		return `${option.label}, sort descending.`;
	}
	const next = nextSortDirection(active, option.id);
	return `${option.label}, sorted ${DIRECTION_LABELS[active.direction]}. Select to sort ${DIRECTION_LABELS[next]}.`;
}
