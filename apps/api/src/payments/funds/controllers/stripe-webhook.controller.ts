/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	Post,
	type RawBodyRequest,
	Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { PublicEndpoint } from '../../../auth/decorators/public-endpoint.decorator';
import { AvailableInMaintenance } from '../../../settings/platform/guards/maintenance.guard';
import {
	STRIPE_SIGNATURE_HEADER,
	STRIPE_WEBHOOK_ROUTE,
} from '../constants/stripe.constants';
import { StripeEventScope } from '../enums/stripe-event-scope.enum';
import { StripeEventInboxService } from '../services/stripe-event/stripe-event-inbox.service';

@Controller(STRIPE_WEBHOOK_ROUTE.BASE)
@ApiExcludeController()
@PublicEndpoint()
@AvailableInMaintenance()
export class StripeWebhookController {
	constructor(private readonly inbox: StripeEventInboxService) {}

	@Post(STRIPE_WEBHOOK_ROUTE.PLATFORM)
	@HttpCode(HttpStatus.OK)
	async receivePlatform(
		@Req() request: RawBodyRequest<Request>,
		@Headers(STRIPE_SIGNATURE_HEADER) signature: string | undefined
	): Promise<void> {
		await this.inbox.accept(
			StripeEventScope.PLATFORM,
			request.rawBody,
			signature
		);
	}

	@Post(STRIPE_WEBHOOK_ROUTE.CONNECT)
	@HttpCode(HttpStatus.OK)
	async receiveConnect(
		@Req() request: RawBodyRequest<Request>,
		@Headers(STRIPE_SIGNATURE_HEADER) signature: string | undefined
	): Promise<void> {
		await this.inbox.accept(
			StripeEventScope.CONNECT,
			request.rawBody,
			signature
		);
	}
}
