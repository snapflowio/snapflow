/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Continent } from '../enums/continent.enum';
import type { LocationConstraintKind } from '../enums/location-constraint-kind.enum';

export interface GeoPoint {
	latitude: number;
	longitude: number;
}

export interface GeoArea {
	country: string;
	continent: Continent;
}

export interface GeoLocation extends GeoPoint, GeoArea {
	city: string | null;
}

export type LocationConstraint =
	| { kind: LocationConstraintKind.COUNTRY; country: string }
	| { kind: LocationConstraintKind.CONTINENT; continent: Continent };
