/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Continent,
	type ContinentMachines,
	type Location,
} from '@snapflow/api-client';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';

const COUNTRY_NAMES = new Intl.DisplayNames(DISPLAY_LOCALE, { type: 'region' });
const CONTINENTS: ReadonlySet<string> = new Set(Object.values(Continent));

const UNKNOWN_LOCATION_LABEL = 'Unknown';
export const AUTOMATIC_LOCATION_LABEL = 'Automatic (nearest)';
export const GEOLOCATION_ATTRIBUTION = {
	label: 'IP geolocation by DB-IP',
	href: 'https://db-ip.com',
} as const;

const CONTINENT_LABELS: Record<Continent, string> = {
	[Continent.Africa]: 'Africa',
	[Continent.Asia]: 'Asia',
	[Continent.Europe]: 'Europe',
	[Continent.NorthAmerica]: 'North America',
	[Continent.Oceania]: 'Oceania',
	[Continent.SouthAmerica]: 'South America',
};

function isContinent(code: string): code is Continent {
	return CONTINENTS.has(code);
}

export function countryName(code: string): string {
	return COUNTRY_NAMES.of(code) ?? code;
}

export function locationCodeLabel(code: string): string {
	return isContinent(code) ? CONTINENT_LABELS[code] : countryName(code);
}

export function formatLocation(
	location: Location | null | undefined
): string | null {
	if (!location) return null;
	const country = countryName(location.country);
	return location.city ? `${location.city}, ${country}` : country;
}

export function locationLabel(location: Location | null | undefined): string {
	return formatLocation(location) ?? UNKNOWN_LOCATION_LABEL;
}

export function matchesLocation(
	location: Location | null | undefined,
	codes: readonly string[]
): boolean {
	if (codes.length === 0) return true;
	if (!location) return false;
	return codes.includes(location.continent) || codes.includes(location.country);
}

export function summarizeLocations(
	locations: readonly (Location | null | undefined)[]
): ContinentMachines[] {
	const continents = new Map<Continent, Map<string, number>>();
	for (const location of locations) {
		if (!location) continue;
		const countries =
			continents.get(location.continent) ?? new Map<string, number>();
		countries.set(location.country, (countries.get(location.country) ?? 0) + 1);
		continents.set(location.continent, countries);
	}
	return [...continents].map(([continent, countries]) => ({
		continent,
		machineCount: [...countries.values()].reduce(
			(total, count) => total + count,
			0
		),
		countries: [...countries].map(([country, machineCount]) => ({
			country,
			machineCount,
		})),
	}));
}

export function locationOptions(
	continents: readonly ContinentMachines[]
): ChipOption[] {
	return continents.flatMap((entry) => {
		const continent = CONTINENT_LABELS[entry.continent];
		return [
			{
				label: `${continent} (${entry.machineCount})`,
				value: entry.continent,
				searchTerms: [continent],
			},
			...entry.countries.map((country) => ({
				label: `${countryName(country.country)} (${country.machineCount})`,
				value: country.country,
				searchTerms: [country.country, continent],
			})),
		];
	});
}
