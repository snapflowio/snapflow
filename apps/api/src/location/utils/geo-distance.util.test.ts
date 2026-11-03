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
import { PROXIMITY_BAND_KM } from '../constants/location.constants';
import type { GeoPoint } from '../types/geo-location.types';
import { distanceKm, geoPoint, proximityBand } from './geo-distance.util';

const FRANKFURT: GeoPoint = { latitude: 50.1109, longitude: 8.6821 };
const PARIS: GeoPoint = { latitude: 48.8566, longitude: 2.3522 };
const SYDNEY: GeoPoint = { latitude: -33.8688, longitude: 151.2093 };
const FRANKFURT_PARIS_KM = 479;
const FRANKFURT_SYDNEY_KM = 16_480;
const TOLERANCE_KM = 5;
const ANTIPODAL_TOLERANCE_KM = 50;

describe('geo distance', () => {
	it('measures great-circle distances', () => {
		assert.ok(
			Math.abs(distanceKm(FRANKFURT, PARIS) - FRANKFURT_PARIS_KM) <=
				TOLERANCE_KM
		);
		assert.ok(
			Math.abs(distanceKm(FRANKFURT, SYDNEY) - FRANKFURT_SYDNEY_KM) <=
				ANTIPODAL_TOLERANCE_KM
		);
		assert.equal(distanceKm(PARIS, PARIS), 0);
		assert.equal(distanceKm(FRANKFURT, PARIS), distanceKm(PARIS, FRANKFURT));
	});

	it('bands distance so nearby machines tie', () => {
		assert.equal(proximityBand(FRANKFURT, FRANKFURT), 0);
		assert.equal(proximityBand(FRANKFURT, PARIS), 0);
		assert.equal(
			proximityBand(FRANKFURT, SYDNEY),
			Math.floor(distanceKm(FRANKFURT, SYDNEY) / PROXIMITY_BAND_KM)
		);
	});

	it('treats every machine as near without an origin, and unknown machines as farthest', () => {
		assert.equal(proximityBand(null, SYDNEY), 0);
		assert.equal(proximityBand(null, null), 0);
		assert.equal(proximityBand(FRANKFURT, null), Number.MAX_SAFE_INTEGER);
		assert.ok(
			proximityBand(FRANKFURT, null) > proximityBand(FRANKFURT, SYDNEY)
		);
	});

	it('only builds a point from complete coordinates', () => {
		assert.deepEqual(geoPoint(PARIS), PARIS);
		assert.equal(geoPoint({ latitude: PARIS.latitude, longitude: null }), null);
		assert.equal(geoPoint({ latitude: null, longitude: null }), null);
	});
});
