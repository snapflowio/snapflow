/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { EncryptionModule } from '../infra/encryption/encryption.module';
import { WebhookDeliveryController } from './controllers/webhook-delivery.controller';
import { WebhookEndpointController } from './controllers/webhook-endpoint.controller';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookDeliveryAttempt } from './entities/webhook-delivery-attempt.entity';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookMessage } from './entities/webhook-message.entity';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { WebhookDisabledNoticeService } from './services/webhook-disabled-notice.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import { WebhookEndpointService } from './services/webhook-endpoint.service';
import { WebhookEventListenerService } from './services/webhook-event-listener.service';
import { WebhookHttpClientService } from './services/webhook-http-client.service';
import { WebhookPublisherService } from './services/webhook-publisher.service';
import { WebhookRetentionService } from './services/webhook-retention.service';
import { WebhookSecretService } from './services/webhook-secret.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			WebhookEndpoint,
			WebhookMessage,
			WebhookDelivery,
			WebhookDeliveryAttempt,
		]),
		EncryptionModule,
	],
	controllers: [WebhookEndpointController, WebhookDeliveryController],
	providers: [
		WebhookSecretService,
		WebhookHttpClientService,
		WebhookPublisherService,
		WebhookEventListenerService,
		WebhookEndpointService,
		WebhookDeliveryService,
		WebhookDispatcherService,
		WebhookDisabledNoticeService,
		WebhookRetentionService,
	],
	exports: [
		WebhookDispatcherService,
		WebhookDisabledNoticeService,
		WebhookRetentionService,
	],
})
export class WebhookModule {}
