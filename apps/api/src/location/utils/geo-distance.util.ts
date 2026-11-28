/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	EARTH_RADIUS_KM,
	PROXIMITY_BAND_KM,
} from '../constants/location.constants';
import type { GeoPoint } from '../types/geo-location.types';

const DEGREES_PER_HALF_TURN = 180;

const NEAREST_BAND = 0;

const UNKNOWN_BAND = Number.MAX_SAFE_INTEGER;

function radians(degrees: number): number {
	return (degrees * Math.PI) / DEGREES_PER_HALF_TURN;
}

export function geoPoint(record: {
	latitude: number | null;
	longitude: number | null;
}): GeoPoint | null {
	return record.latitude === null || record.longitude === null
		? null
		: { latitude: record.latitude, longitude: record.longitude };
}

export function distanceKm(from: GeoPoint, to: GeoPoint): number {
	const latitudeDelta = radians(to.latitude - from.latitude);
	const longitudeDelta = radians(to.longitude - from.longitude);
	const haversine =
		Math.sin(latitudeDelta / 2) ** 2 +
		Math.cos(radians(from.latitude)) *
			Math.cos(radians(to.latitude)) *
			Math.sin(longitudeDelta / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function proximityBand(
	origin: GeoPoint | null,
	point: GeoPoint | null
): number {
	if (!origin) return NEAREST_BAND;
	if (!point) return UNKNOWN_BAND;
	return Math.floor(distanceKm(origin, point) / PROXIMITY_BAND_KM);
}
