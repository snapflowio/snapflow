/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { LocationDto } from '../../location/dto/location.dto';
import type { Continent } from '../../location/enums/continent.enum';
import { GeoIpService } from '../../location/services/geo-ip.service';
import type {
	ContinentMachinesDto,
	MachineLocationsDto,
} from '../dto/machine-locations.dto';
import {
	type MachineLocationRow,
	machineLocationQuery,
} from '../queries/machine-location.query';

function groupByContinent(
	rows: readonly MachineLocationRow[]
): ContinentMachinesDto[] {
	const continents = new Map<Continent, ContinentMachinesDto>();
	for (const row of rows) {
		const entry = continents.get(row.continent) ?? {
			continent: row.continent,
			machineCount: 0,
			countries: [],
		};
		entry.machineCount += row.machine_count;
		entry.countries.push({
			country: row.country,
			machineCount: row.machine_count,
		});
		continents.set(row.continent, entry);
	}
	return [...continents.values()];
}

@Injectable()
export class MachineLocationDirectoryService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly geoIp: GeoIpService
	) {}

	async list(
		organizationId: string,
		callerAddress: string | undefined
	): Promise<MachineLocationsDto> {
		const query = machineLocationQuery(organizationId);
		const rows = await this.entityManager.execute<MachineLocationRow[]>(
			query.sql,
			query.bindings
		);
		const caller = this.geoIp.locate(callerAddress);
		return {
			caller: caller && LocationDto.from(caller),
			continents: groupByContinent(rows),
		};
	}
}
