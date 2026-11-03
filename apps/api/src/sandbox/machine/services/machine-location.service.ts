/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { GeoIpService } from '../../../location/services/geo-ip.service';
import type { Machine } from '../entities/machine.entity';

type LocatedMachine = Pick<
	Machine,
	'country' | 'continent' | 'city' | 'latitude' | 'longitude'
>;

@Injectable()
export class MachineLocationService {
	constructor(private readonly geoIp: GeoIpService) {}

	locate(machine: LocatedMachine, address: string | undefined): void {
		const location = this.geoIp.locate(address);
		if (!location) return;
		machine.country = location.country;
		machine.continent = location.continent;
		machine.city = location.city;
		machine.latitude = location.latitude;
		machine.longitude = location.longitude;
	}
}
