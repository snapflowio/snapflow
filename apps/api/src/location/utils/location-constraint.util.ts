/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	COUNTRY_CODE_PATTERN,
	LOCATION_NAME_LANGUAGE,
	NON_COUNTRY_CODE_PATTERN,
} from '../constants/location.constants';
import { Continent } from '../enums/continent.enum';
import { LocationConstraintKind } from '../enums/location-constraint-kind.enum';
import type { GeoArea, LocationConstraint } from '../types/geo-location.types';

const CONTINENTS: ReadonlySet<string> = new Set(Object.values(Continent));

const COUNTRY_NAMES = new Intl.DisplayNames([LOCATION_NAME_LANGUAGE], {
	type: 'region',
	fallback: 'none',
});

const NO_PREFERENCE_MATCH = -1;

function isContinent(code: string): code is Continent {
	return CONTINENTS.has(code);
}

function isCountryCode(code: string): boolean {
	return (
		COUNTRY_CODE_PATTERN.test(code) &&
		!NON_COUNTRY_CODE_PATTERN.test(code) &&
		COUNTRY_NAMES.of(code) !== undefined
	);
}

export function isLocationCode(code: string): boolean {
	return isContinent(code) || isCountryCode(code);
}

export function parseLocationConstraint(code: string): LocationConstraint {
	if (isContinent(code)) {
		return { kind: LocationConstraintKind.CONTINENT, continent: code };
	}
	if (isCountryCode(code)) {
		return { kind: LocationConstraintKind.COUNTRY, country: code };
	}
	throw new Error(`${code} is neither a continent nor a country code`);
}

export function locationConstraintCode(constraint: LocationConstraint): string {
	return constraint.kind === LocationConstraintKind.CONTINENT
		? constraint.continent
		: constraint.country;
}

function matches(constraint: LocationConstraint, area: GeoArea): boolean {
	return constraint.kind === LocationConstraintKind.CONTINENT
		? constraint.continent === area.continent
		: constraint.country === area.country;
}

export function locationPreferenceRank(
	constraints: readonly LocationConstraint[],
	area: GeoArea | null
): number {
	if (constraints.length === 0) return 0;
	if (!area) return NO_PREFERENCE_MATCH;
	return constraints.findIndex((constraint) => matches(constraint, area));
}

export function locationWhere(code: string | undefined): Partial<GeoArea> {
	if (code === undefined) return {};
	const constraint = parseLocationConstraint(code);
	return constraint.kind === LocationConstraintKind.CONTINENT
		? { continent: constraint.continent }
		: { country: constraint.country };
}

export function constrainedCountries(
	constraints: readonly LocationConstraint[]
): string[] {
	return constraints.flatMap((constraint) =>
		constraint.kind === LocationConstraintKind.COUNTRY
			? [constraint.country]
			: []
	);
}

export function constrainedContinents(
	constraints: readonly LocationConstraint[]
): Continent[] {
	return constraints.flatMap((constraint) =>
		constraint.kind === LocationConstraintKind.CONTINENT
			? [constraint.continent]
			: []
	);
}
