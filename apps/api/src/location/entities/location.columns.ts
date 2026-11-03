/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Continent } from '../enums/continent.enum';

export const GEO_COORDINATE_COLUMN = Object.freeze({
	type: 'number',
	columnType: 'double precision',
	nullable: true,
} as const);

export const COUNTRY_COLUMN = Object.freeze({
	type: 'string',
	columnType: 'varchar(2)',
	nullable: true,
} as const);

export const CITY_COLUMN = Object.freeze({
	type: 'string',
	columnType: 'varchar',
	nullable: true,
} as const);

export const CONTINENT_COLUMN = Object.freeze({
	items: () => Continent,
	nativeEnumName: 'continent_enum',
	nullable: true,
} as const);
