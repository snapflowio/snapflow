/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Cloudflare, {
	AuthenticationError,
	NotFoundError,
	PermissionDeniedError,
} from 'cloudflare';
import type { FallbackOriginGetResponse } from 'cloudflare/resources/custom-hostnames/fallback-origin';
import {
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { RefreshingValue } from '../utils/refreshing-value.util';

const CLOUDFLARE_REQUEST_TIMEOUT_MILLISECONDS = 15_000;
const CLOUDFLARE_MAXIMUM_RETRIES = 3;
const ZONE_CACHE_MILLISECONDS = MILLISECONDS_PER_HOUR;
const FALLBACK_ORIGIN_CACHE_MINUTES = 5;
const FALLBACK_ORIGIN_CACHE_MILLISECONDS =
	FALLBACK_ORIGIN_CACHE_MINUTES * MILLISECONDS_PER_MINUTE;
const ACTIVE_FALLBACK_ORIGIN_STATUS = 'active';
const DOMAIN_LABEL_SEPARATOR = '.';
const MINIMUM_ZONE_LABELS = 2;
const TOKEN_VARIABLE = 'SNAPFLOW_CLOUDFLARE_API_TOKEN';

export interface CloudflareZoneConnection {
	readonly client: Cloudflare;
	readonly zoneId: string;
}

@Injectable()
export class CloudflareZoneService {
	readonly client: Cloudflare | null;
	private readonly platformDomain: string | null;
	private readonly zone: RefreshingValue<CloudflareZoneConnection>;
	private readonly fallbackOrigin: RefreshingValue<string>;

	constructor(config: TypedConfigService) {
		const apiToken = config.get('cloudflareIngress.apiToken');
		this.platformDomain =
			config.get('networking.platformDomain')?.toLowerCase() ?? null;
		this.client =
			apiToken && this.platformDomain
				? new Cloudflare({
						apiToken,
						maxRetries: CLOUDFLARE_MAXIMUM_RETRIES,
						timeout: CLOUDFLARE_REQUEST_TIMEOUT_MILLISECONDS,
					})
				: null;
		this.zone = new RefreshingValue(
			() => this.lookUpZone(),
			ZONE_CACHE_MILLISECONDS
		);
		this.fallbackOrigin = new RefreshingValue(
			() => this.lookUpFallbackOrigin(),
			FALLBACK_ORIGIN_CACHE_MILLISECONDS
		);
	}

	isConfigured(): boolean {
		return this.client !== null;
	}

	connection(): Promise<CloudflareZoneConnection> {
		return this.zone.get();
	}

	customHostnameTarget(): Promise<string> {
		return this.fallbackOrigin.get();
	}

	private async lookUpZone(): Promise<CloudflareZoneConnection> {
		const { client, platformDomain } = this.requireConfiguration();
		for (const name of zoneCandidates(platformDomain)) {
			const zones = await cloudflareRequest(
				'Zone:Read',
				`list the zones named ${name}`,
				() => client.zones.list({ name })
			);
			const zone = zones.result.find(
				(candidate) => candidate.name.toLowerCase() === name
			);
			if (zone) return { client, zoneId: zone.id };
		}
		throw new ServiceUnavailableException(
			`No Cloudflare zone of ${platformDomain} is visible to ${TOKEN_VARIABLE}: add the zone to the account and grant the token Zone:Read on it`
		);
	}

	private async lookUpFallbackOrigin(): Promise<string> {
		const { client, zoneId } = await this.zone.get();
		let fallback: FallbackOriginGetResponse;
		try {
			fallback = await cloudflareRequest(
				'SSL and Certificates:Read',
				'read the custom hostname fallback origin',
				() => client.customHostnames.fallbackOrigin.get({ zone_id: zoneId })
			);
		} catch (error) {
			if (!(error instanceof NotFoundError)) throw error;
			throw missingFallbackOrigin(this.platformDomain);
		}
		if (!fallback.origin) throw missingFallbackOrigin(this.platformDomain);
		if (fallback.status !== ACTIVE_FALLBACK_ORIGIN_STATUS) {
			throw new ServiceUnavailableException(
				`The Cloudflare for SaaS fallback origin ${fallback.origin} is ${fallback.status ?? 'unknown'}, not ${ACTIVE_FALLBACK_ORIGIN_STATUS}${fallback.errors?.length ? `: ${fallback.errors.join('; ')}` : ''}`
			);
		}
		return fallback.origin.toLowerCase();
	}

	private requireConfiguration(): {
		client: Cloudflare;
		platformDomain: string;
	} {
		if (!this.client || !this.platformDomain) {
			throw new ServiceUnavailableException(
				`Cloudflare ingress is not configured: set ${TOKEN_VARIABLE} and SNAPFLOW_PLATFORM_DOMAIN`
			);
		}
		return { client: this.client, platformDomain: this.platformDomain };
	}
}

function zoneCandidates(domain: string): string[] {
	const labels = domain.replace(/\.$/, '').split(DOMAIN_LABEL_SEPARATOR);
	const candidates: string[] = [];
	for (
		let start = 0;
		labels.length - start >= MINIMUM_ZONE_LABELS;
		start += 1
	) {
		candidates.push(labels.slice(start).join(DOMAIN_LABEL_SEPARATOR));
	}
	return candidates;
}

function missingFallbackOrigin(
	platformDomain: string | null
): ServiceUnavailableException {
	return new ServiceUnavailableException(
		`The Cloudflare zone of ${platformDomain} has no custom hostname fallback origin: set one under SSL/TLS > Custom Hostnames (Cloudflare for SaaS)`
	);
}

async function cloudflareRequest<Result>(
	permission: string,
	action: string,
	request: () => Promise<Result>
): Promise<Result> {
	try {
		return await request();
	} catch (error) {
		if (error instanceof AuthenticationError) {
			throw new ServiceUnavailableException(
				`Cloudflare rejected ${TOKEN_VARIABLE} while trying to ${action}: replace the token`
			);
		}
		if (error instanceof PermissionDeniedError) {
			throw new ServiceUnavailableException(
				`${TOKEN_VARIABLE} may not ${action}: grant it ${permission} on the platform domain's zone`
			);
		}
		throw error;
	}
}
