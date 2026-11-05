/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../idempotency/idempotency.module';
import { RedisConnectionModule } from '../../infra/redis/redis.module';
import { NetworkingCloudflareModule } from '../cloudflare/cloudflare.module';
import { NetworkingModule } from '../networking.module';
import { CloudflareWebhookController } from './controllers/cloudflare-webhook.controller';
import { CustomDomainController } from './controllers/custom-domain.controller';
import { CloudflareWebhookService } from './services/cloudflare-webhook.service';
import { CustomDomainService } from './services/custom-domain.service';
import { CustomDomainReconcilerService } from './services/custom-domain-reconciler.service';

@Module({
	imports: [
		IdempotencyModule,
		NetworkingCloudflareModule,
		NetworkingModule,
		RedisConnectionModule,
	],
	controllers: [CloudflareWebhookController, CustomDomainController],
	providers: [
		CloudflareWebhookService,
		CustomDomainService,
		CustomDomainReconcilerService,
	],
	exports: [CustomDomainReconcilerService],
})
export class NetworkingCustomDomainModule {}
