/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { StripeEventType } from '../../constants/stripe.constants';
import { StripePaymentEventService } from '../../services/stripe-event/stripe-payment-event.service';
import type {
	StripeEventHandler,
	StripeEventOf,
} from '../../types/stripe-event-handler.types';

@Injectable()
export class CheckoutSessionCompletedHandler
	implements
		StripeEventHandler<typeof StripeEventType.CHECKOUT_SESSION_COMPLETED>
{
	readonly eventTypes = [StripeEventType.CHECKOUT_SESSION_COMPLETED] as const;

	constructor(private readonly payments: StripePaymentEventService) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.CHECKOUT_SESSION_COMPLETED>
	): Promise<void> {
		await this.payments.checkoutSessionCompleted(
			await event.fetchRelatedObject()
		);
	}
}

@Injectable()
export class CheckoutSessionExpiredHandler
	implements StripeEventHandler<typeof StripeEventType.CHECKOUT_SESSION_EXPIRED>
{
	readonly eventTypes = [StripeEventType.CHECKOUT_SESSION_EXPIRED] as const;

	constructor(private readonly payments: StripePaymentEventService) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.CHECKOUT_SESSION_EXPIRED>
	): Promise<void> {
		await this.payments.checkoutSessionExpired(
			await event.fetchRelatedObject()
		);
	}
}
