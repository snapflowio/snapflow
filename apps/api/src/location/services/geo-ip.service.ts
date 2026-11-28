/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type CityResponse, open, type Reader, validate } from 'maxmind';
import { unmappedIpAddress } from '../../common/utils/ip-address.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	CONTINENT_BY_GEOIP_CODE,
	LOCATION_NAME_LANGUAGE,
} from '../constants/location.constants';
import {
	SANCTIONED_COUNTRIES,
	SANCTIONED_SUBDIVISIONS,
} from '../constants/sanctioned-region.constants';
import type { GeoLocation } from '../types/geo-location.types';

@Injectable()
export class GeoIpService implements OnModuleInit {
	private reader: Reader<CityResponse> | undefined;

	constructor(private readonly config: TypedConfigService) {}

	async onModuleInit(): Promise<void> {
		this.reader = await open<CityResponse>(
			this.config.getOrThrow('geoIp.databasePath')
		);
	}

	inSanctionedRegion(address: string | undefined): boolean {
		const record = this.record(address);
		const country = record?.country?.iso_code;
		if (!country) return false;
		if (SANCTIONED_COUNTRIES.has(country)) return true;
		const regions = SANCTIONED_SUBDIVISIONS.get(country);
		return (record?.subdivisions ?? []).some((subdivision) =>
			regions?.has(subdivision.names[LOCATION_NAME_LANGUAGE] ?? '')
		);
	}

	locate(address: string | undefined): GeoLocation | null {
		const record = this.record(address);
		const country = record?.country?.iso_code;
		const continent = record?.continent
			? CONTINENT_BY_GEOIP_CODE.get(record.continent.code)
			: undefined;
		if (!record?.location || !country || !continent) return null;
		return {
			country,
			continent,
			city: record.city?.names.en ?? null,
			latitude: record.location.latitude,
			longitude: record.location.longitude,
		};
	}

	private record(address: string | undefined): CityResponse | null {
		if (!this.reader) {
			throw new Error('The IP geolocation database is not loaded');
		}
		if (!address) return null;
		const normalized = unmappedIpAddress(address);
		if (!validate(normalized)) return null;
		return this.reader.get(normalized);
	}
}
