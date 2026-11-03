/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Continent } from '../enums/continent.enum';

export const CONTINENT_BY_GEOIP_CODE: ReadonlyMap<string, Continent> = new Map([
	['AF', Continent.AFRICA],
	['AS', Continent.ASIA],
	['EU', Continent.EUROPE],
	['NA', Continent.NORTH_AMERICA],
	['OC', Continent.OCEANIA],
	['SA', Continent.SOUTH_AMERICA],
]);

export const LOCATION_NAME_LANGUAGE = 'en';

export const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export const NON_COUNTRY_CODE_PATTERN = /^(?:AA|Q[M-Z]|X[A-JL-Z]|ZZ|EU|EZ|UN)$/;

export const PLACEMENT_LOCATION_LIMIT = 16;

export const EARTH_RADIUS_KM = 6_371;

export const PROXIMITY_BAND_KM = 500;
