/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Continent } from '../enums/continent.enum';
import { LocationConstraintKind } from '../enums/location-constraint-kind.enum';
import type { GeoArea } from '../types/geo-location.types';
import {
	constrainedContinents,
	constrainedCountries,
	isLocationCode,
	locationConstraintCode,
	locationPreferenceRank,
	locationWhere,
	parseLocationConstraint,
} from './location-constraint.util';

const GERMANY = 'DE';
const FRANCE = 'FR';
const FRANKFURT: GeoArea = { country: GERMANY, continent: Continent.EUROPE };
const TOKYO: GeoArea = { country: 'JP', continent: Continent.ASIA };

describe('location constraints', () => {
	it('parses continents and ISO countries', () => {
		assert.deepEqual(parseLocationConstraint(Continent.NORTH_AMERICA), {
			kind: LocationConstraintKind.CONTINENT,
			continent: Continent.NORTH_AMERICA,
		});
		assert.deepEqual(parseLocationConstraint(GERMANY), {
			kind: LocationConstraintKind.COUNTRY,
			country: GERMANY,
		});
	});

	it('rejects codes that are neither a continent nor a country', () => {
		for (const code of [
			'de',
			'XX',
			'ZZ',
			'EU',
			'UN',
			'QO',
			'eu-west',
			'Europe',
			'DEU',
			'',
		]) {
			assert.equal(isLocationCode(code), false, code);
			assert.throws(() => parseLocationConstraint(code));
		}
	});

	it('accepts Kosovo, which IP geolocation reports as XK', () => {
		assert.equal(isLocationCode('XK'), true);
	});

	it('round-trips constraint codes', () => {
		for (const code of [GERMANY, Continent.OCEANIA]) {
			assert.equal(locationConstraintCode(parseLocationConstraint(code)), code);
		}
	});

	it('ranks an area by the first constraint it matches', () => {
		const constraints = [FRANCE, Continent.EUROPE, Continent.ASIA].map(
			parseLocationConstraint
		);

		assert.equal(locationPreferenceRank(constraints, FRANKFURT), 1);
		assert.equal(locationPreferenceRank(constraints, TOKYO), 2);
		assert.ok(
			locationPreferenceRank([FRANCE].map(parseLocationConstraint), FRANKFURT) <
				0
		);
	});

	it('treats every area alike without constraints, and unknown areas as unmatched', () => {
		assert.equal(locationPreferenceRank([], TOKYO), 0);
		assert.equal(locationPreferenceRank([], null), 0);
		assert.ok(
			locationPreferenceRank([GERMANY].map(parseLocationConstraint), null) < 0
		);
	});

	it('splits constraints into countries and continents', () => {
		const constraints = [GERMANY, Continent.ASIA, FRANCE].map(
			parseLocationConstraint
		);

		assert.deepEqual(constrainedCountries(constraints), [GERMANY, FRANCE]);
		assert.deepEqual(constrainedContinents(constraints), [Continent.ASIA]);
	});

	it('builds an entity filter for one location code', () => {
		assert.deepEqual(locationWhere(undefined), {});
		assert.deepEqual(locationWhere(GERMANY), { country: GERMANY });
		assert.deepEqual(locationWhere(Continent.AFRICA), {
			continent: Continent.AFRICA,
		});
	});
});
