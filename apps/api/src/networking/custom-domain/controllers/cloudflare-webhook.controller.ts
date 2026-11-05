/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Body,
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicEndpoint } from '../../../auth/decorators/public-endpoint.decorator';
import { NETWORKING_THROTTLE } from '../../constants/networking.constants';
import { CloudflareCustomHostnameWebhookDto } from '../dto/cloudflare-webhook.dto';
import {
	CLOUDFLARE_WEBHOOK_AUTH_HEADER,
	CloudflareWebhookService,
} from '../services/cloudflare-webhook.service';

@Controller('webhooks/cloudflare/custom-hostnames')
@ApiExcludeController()
export class CloudflareWebhookController {
	constructor(private readonly webhooks: CloudflareWebhookService) {}

	@Post()
	@HttpCode(HttpStatus.ACCEPTED)
	@PublicEndpoint()
	@Throttle({ default: NETWORKING_THROTTLE.cloudflareWebhook })
	accept(
		@Headers(CLOUDFLARE_WEBHOOK_AUTH_HEADER)
		providedSecret: string | undefined,
		@Body() payload: CloudflareCustomHostnameWebhookDto
	): Promise<void> {
		return this.webhooks.accept(providedSecret, payload);
	}
}
