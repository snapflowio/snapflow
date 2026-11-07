/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';
import {
	listEntries,
	type SettingField,
	type SettingPattern,
} from './settings-fields.ts';

const WHOLE_NUMBER_PATTERN = /^\d+$/;

export const HTTP_URL_PATTERN: SettingPattern = {
	regex: /^https?:\/\/\S+$/,
	message: 'Enter an HTTP(S) URL',
};

export const IP_NETWORK_PATTERN: SettingPattern = {
	regex: /^[\da-f.:]+\/\d{1,3}$/i,
	message: 'Enter one network per line as address/prefix',
};

export const UUID_PATTERN: SettingPattern = {
	regex: /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i,
	message: 'Enter an organization ID',
};

type SettingSchema = z.ZodType<boolean | string, boolean | string>;

function fieldSchema(field: SettingField): SettingSchema {
	switch (field.kind) {
		case 'switch':
			return z.boolean();
		case 'quantity':
			return z
				.string()
				.trim()
				.regex(WHOLE_NUMBER_PATTERN, 'Enter a whole number');
		case 'choice':
			return z.string().min(1, `Select a ${field.label.toLowerCase()}`);
		case 'list': {
			const { maximum, pattern } = field;
			return z
				.string()
				.refine(
					(value) => listEntries(value).length <= maximum,
					`Enter at most ${maximum} entries`
				)
				.refine(
					(value) =>
						listEntries(value).every((entry) => pattern.regex.test(entry)),
					pattern.message
				);
		}
		case 'text': {
			const text = field.optional
				? z.string().trim()
				: z.string().trim().min(1, `${field.label} is required`);
			const { pattern } = field;
			return pattern
				? text.refine(
						(value) => value.length === 0 || pattern.regex.test(value),
						pattern.message
					)
				: text;
		}
	}
}

export function settingFormSchema(fields: readonly SettingField[]) {
	return z.object(
		Object.fromEntries(fields.map((field) => [field.name, fieldSchema(field)]))
	);
}
