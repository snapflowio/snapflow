/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResourceFilterTag } from '#lib/components/resource/resource-options.ts';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';

export interface AdminFilterField<TValue extends string = string> {
	id: string;
	label: string;
	options: readonly ChipOption<TValue>[];
	values: readonly TValue[];
	onChange(values: TValue[]): void;
}

export function adminFilterTags(
	fields: readonly AdminFilterField[]
): ResourceFilterTag[] {
	return fields.flatMap((field) =>
		field.values.map((value) => ({
			label: `${field.label}: ${field.options.find((option) => option.value === value)?.label ?? value}`,
			onRemove: () =>
				field.onChange(field.values.filter((selected) => selected !== value)),
		}))
	);
}

export function hasAdminFilters(fields: readonly AdminFilterField[]): boolean {
	return fields.some((field) => field.values.length > 0);
}

export function adminFilterOptions<const TValue extends string>(
	labels: Readonly<Record<TValue, string>>
): ChipOption<TValue>[] {
	return (Object.keys(labels) as TValue[]).map((value) => ({
		label: labels[value],
		value,
	}));
}

export function adminFilter<const TValue extends string>(
	field: AdminFilterField<TValue>
): AdminFilterField<TValue> {
	return field;
}
