/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Settings, UpdateSettings } from '@snapflow/api-client';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import type { KeysOfType } from '#lib/utils/type-utils.ts';

type QuantitySettingKey = KeysOfType<UpdateSettings, number>;
type SwitchSettingKey = KeysOfType<UpdateSettings, boolean>;
type TextSettingKey = KeysOfType<UpdateSettings, string>;
type ListSettingKey = KeysOfType<UpdateSettings, string[]>;
type QuantityListSettingKey = KeysOfType<UpdateSettings, number[]>;

export interface SettingPattern {
	message: string;
	regex: RegExp;
}

interface QuantitySettingField {
	kind: 'quantity';
	label: string;
	name: QuantitySettingKey;
	unit: string;
}

interface SwitchSettingField {
	description: string;
	kind: 'switch';
	label: string;
	name: SwitchSettingKey;
}

interface TextSettingField {
	hint?: string;
	kind: 'text';
	label: string;
	name: TextSettingKey;
	optional?: boolean;
	pattern?: SettingPattern;
	placeholder?: string;
}

interface ListSettingField {
	hint?: string;
	kind: 'list';
	label: string;
	maximum: number;
	name: ListSettingKey;
	pattern: SettingPattern;
	placeholder?: string;
}

interface QuantityListSettingField {
	kind: 'quantityList';
	label: string;
	maximum: number;
	name: QuantityListSettingKey;
	placeholder?: string;
	unit: string;
}

interface ChoiceSettingField {
	kind: 'choice';
	label: string;
	name: TextSettingKey;
	options: readonly ChipOption[];
}

export type SettingField =
	| ChoiceSettingField
	| ListSettingField
	| QuantityListSettingField
	| QuantitySettingField
	| SwitchSettingField
	| TextSettingField;

export interface SettingsSection {
	fields: readonly SettingField[];
	note: string;
	title: string;
}

export type SettingFormValues = Record<string, boolean | string>;

const LIST_SEPARATOR = '\n';

export function quantitySetting(
	name: QuantitySettingKey,
	label: string,
	unit: string
): SettingField {
	return { kind: 'quantity', name, label, unit };
}

export function listEntries(value: string): string[] {
	return value
		.split(LIST_SEPARATOR)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export function settingFormValues(
	settings: Settings,
	fields: readonly SettingField[]
): SettingFormValues {
	return Object.fromEntries(
		fields.map((field) => {
			const value = settings[field.name];
			if (Array.isArray(value)) {
				return [field.name, value.join(LIST_SEPARATOR)];
			}
			return [
				field.name,
				typeof value === 'boolean' ? value : String(value ?? ''),
			];
		})
	);
}

function apiValue(
	field: SettingField,
	value: boolean | string
): boolean | number | number[] | string | string[] | null {
	if (typeof value === 'boolean') return value;
	if (field.kind === 'quantity') return Number(value);
	if (field.kind === 'quantityList') return listEntries(value).map(Number);
	if (field.kind === 'list') return listEntries(value);
	const trimmed = value.trim();
	return field.kind === 'text' && field.optional && !trimmed ? null : trimmed;
}

export function changedSettings(
	fields: readonly SettingField[],
	initial: SettingFormValues,
	values: SettingFormValues
): UpdateSettings {
	return Object.fromEntries(
		fields.flatMap((field) => {
			const value = values[field.name];
			return value === undefined || value === initial[field.name]
				? []
				: [[field.name, apiValue(field, value)]];
		})
	);
}
