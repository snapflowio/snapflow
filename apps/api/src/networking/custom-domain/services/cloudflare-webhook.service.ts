/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { FilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { CloudflareZoneService } from '../../cloudflare/services/cloudflare-zone.service';
import { CustomDomain } from '../../entities/custom-domain.entity';
import type { CloudflareCustomHostnameWebhookDto } from '../dto/cloudflare-webhook.dto';

export const CLOUDFLARE_WEBHOOK_AUTH_HEADER = 'cf-webhook-auth';

@Injectable()
export class CloudflareWebhookService {
	private readonly secret: string | undefined;

	constructor(
		private readonly entityManager: EntityManager,
		private readonly zone: CloudflareZoneService,
		config: TypedConfigService
	) {
		this.secret = config.get('cloudflareIngress.webhookSecret');
	}

	async accept(
		providedSecret: string | undefined,
		payload: CloudflareCustomHostnameWebhookDto
	): Promise<void> {
		if (!this.secret || !this.matchesSecret(providedSecret)) {
			throw new UnauthorizedException('Invalid Cloudflare webhook secret');
		}
		const payloadZoneId = payload.metadata?.zone?.id?.trim();
		if (
			payloadZoneId &&
			payloadZoneId !== (await this.zone.connection()).zoneId
		) {
			throw new UnauthorizedException('Cloudflare webhook zone does not match');
		}
		const providerId = payload.data?.id?.trim();
		const hostname = payload.data?.hostname
			?.trim()
			.toLowerCase()
			.replace(/\.$/, '');
		if (!providerId && !hostname) return;
		const matches: FilterQuery<CustomDomain>[] = [
			...(providerId ? [{ providerId }] : []),
			...(hostname ? [{ hostname }] : []),
		];
		await this.entityManager.nativeUpdate(
			CustomDomain,
			{ $or: matches },
			{
				lastSynchronizedAt: null,
				updatedAt: await databaseNow(this.entityManager),
			}
		);
	}

	private matchesSecret(provided: string | undefined): boolean {
		if (!provided || !this.secret) return false;
		const expectedDigest = createHash('sha256').update(this.secret).digest();
		const providedDigest = createHash('sha256').update(provided).digest();
		return timingSafeEqual(expectedDigest, providedDigest);
	}
}
