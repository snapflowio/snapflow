/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import { countryName } from '#lib/features/locations/lib/location-format.ts';

export function payoutCountryOptions(
	countries: readonly string[]
): ChipOption[] {
	return countries
		.map((code) => ({
			label: countryName(code),
			value: code,
			searchTerms: [code],
		}))
		.sort((left, right) => left.label.localeCompare(right.label));
}
