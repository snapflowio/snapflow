/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CountryCodes } from 'validator/es/lib/isISO31661Alpha2';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';

const COUNTRY_NAMES = new Intl.DisplayNames(DISPLAY_LOCALE, { type: 'region' });

export function countryName(code: string): string {
	return COUNTRY_NAMES.of(code) ?? code;
}

export const COUNTRY_OPTIONS = [...CountryCodes]
	.map((code) => ({ value: code, label: countryName(code) }))
	.sort((left, right) => left.label.localeCompare(right.label, DISPLAY_LOCALE));
