/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Component } from 'svelte';

export type ChipIcon = Component<{ class?: string }>;

export interface ChipOption<TValue extends string = string> {
	label: string;
	value: TValue;
	searchTerms?: readonly string[];
	icon?: ChipIcon;
	disabled?: boolean;
}

export function selectedOptionLabel<TValue extends string>(
	options: readonly ChipOption<TValue>[],
	value: TValue | undefined,
	fallback: string
): string {
	return options.find((option) => option.value === value)?.label ?? fallback;
}

export function multiSelectionLabel<TValue extends string>(
	options: readonly ChipOption<TValue>[],
	selectedValues: readonly TValue[],
	labels: { empty: string; missing: string }
): string {
	const [first] = selectedValues;
	if (first === undefined) return labels.empty;
	if (selectedValues.length === 1) {
		return selectedOptionLabel(options, first, labels.missing);
	}
	return `${selectedValues.length} selected`;
}

function optionMatchesSearch(
	option: ChipOption<string>,
	query: string
): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) return true;
	const terms = [option.label, ...(option.searchTerms ?? [])];
	return terms.some((term) =>
		term.trim().toLowerCase().includes(normalizedQuery)
	);
}

export function filterOptions<TValue extends string>(
	options: readonly ChipOption<TValue>[],
	query: string
): readonly ChipOption<TValue>[] {
	return options.filter((option) => optionMatchesSearch(option, query));
}

export function toggleSelection<TValue extends string>(
	selectedValues: readonly TValue[],
	value: TValue
): TValue[] {
	return selectedValues.includes(value)
		? selectedValues.filter((selected) => selected !== value)
		: [...selectedValues, value];
}
