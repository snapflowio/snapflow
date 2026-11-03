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
import { TypedConfigService } from '../../config/services/typed-config.service';
import { CONTINENT_BY_GEOIP_CODE } from '../constants/location.constants';
import type { GeoLocation } from '../types/geo-location.types';

const IPV4_MAPPED_IPV6_PREFIX = '::ffff:';

function normalizeAddress(address: string): string {
	return address.startsWith(IPV4_MAPPED_IPV6_PREFIX)
		? address.slice(IPV4_MAPPED_IPV6_PREFIX.length)
		: address;
}

@Injectable()
export class GeoIpService implements OnModuleInit {
	private reader: Reader<CityResponse> | undefined;

	constructor(private readonly config: TypedConfigService) {}

	async onModuleInit(): Promise<void> {
		this.reader = await open<CityResponse>(
			this.config.getOrThrow('geoIp.databasePath')
		);
	}

	locate(address: string | undefined): GeoLocation | null {
		if (!this.reader) {
			throw new Error('The IP geolocation database is not loaded');
		}
		if (!address) return null;
		const normalized = normalizeAddress(address);
		if (!validate(normalized)) return null;
		const record = this.reader.get(normalized);
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
}
