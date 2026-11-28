/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Continent } from '../enums/continent.enum';

export interface LocatedRecord {
	country: string | null;
	continent: Continent | null;
	city: string | null;
}

@ApiSchema({ name: 'Location' })
export class LocationDto {
	@ApiProperty({
		description: 'ISO 3166-1 alpha-2 country code',
		example: 'DE',
	})
	country: string;

	@ApiProperty({ enum: Continent, enumName: 'Continent' })
	continent: Continent;

	@ApiProperty({
		type: String,
		nullable: true,
		description: 'City the IP geolocation database places the address in',
		example: 'Frankfurt am Main',
	})
	city: string | null;

	static from(record: LocatedRecord): LocationDto | null {
		if (!record.country || !record.continent) return null;
		return {
			country: record.country,
			continent: record.continent,
			city: record.city,
		};
	}
}
