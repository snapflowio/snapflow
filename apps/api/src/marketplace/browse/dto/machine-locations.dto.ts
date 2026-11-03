/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { LocationDto } from '../../../location/dto/location.dto';
import { Continent } from '../../../location/enums/continent.enum';

@ApiSchema({ name: 'CountryMachines' })
export class CountryMachinesDto {
	@ApiProperty({
		description: 'ISO 3166-1 alpha-2 country code',
		example: 'DE',
	})
	country: string;

	@ApiProperty({ description: 'Listed machines the organization can use' })
	machineCount: number;
}

@ApiSchema({ name: 'ContinentMachines' })
export class ContinentMachinesDto {
	@ApiProperty({ enum: Continent, enumName: 'Continent' })
	continent: Continent;

	@ApiProperty({ description: 'Listed machines the organization can use' })
	machineCount: number;

	@ApiProperty({ type: CountryMachinesDto, isArray: true })
	countries: CountryMachinesDto[];
}

@ApiSchema({ name: 'MachineLocations' })
export class MachineLocationsDto {
	@ApiProperty({
		type: LocationDto,
		nullable: true,
		description:
			'Where the caller is according to IP geolocation; automatic placement prefers machines near it',
	})
	caller: LocationDto | null;

	@ApiProperty({ type: ContinentMachinesDto, isArray: true })
	continents: ContinentMachinesDto[];
}
