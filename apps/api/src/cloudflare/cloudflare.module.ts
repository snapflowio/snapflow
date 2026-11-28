/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { CloudflareDomainProvider } from './services/cloudflare-domain-provider.service';
import { CloudflareOriginPullService } from './services/cloudflare-origin-pull.service';
import { CloudflareZoneService } from './services/cloudflare-zone.service';

@Module({
	imports: [RedisConnectionModule],
	providers: [
		CloudflareZoneService,
		CloudflareDomainProvider,
		CloudflareOriginPullService,
	],
	exports: [
		CloudflareZoneService,
		CloudflareDomainProvider,
		CloudflareOriginPullService,
	],
})
export class CloudflareModule {}
