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
export class PaymentIntentSucceededHandler
	implements StripeEventHandler<typeof StripeEventType.PAYMENT_INTENT_SUCCEEDED>
{
	readonly eventTypes = [StripeEventType.PAYMENT_INTENT_SUCCEEDED] as const;

	constructor(private readonly payments: StripePaymentEventService) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.PAYMENT_INTENT_SUCCEEDED>
	): Promise<void> {
		await this.payments.paymentIntentSucceeded(
			await event.fetchRelatedObject()
		);
	}
}

@Injectable()
export class PaymentIntentPaymentFailedHandler
	implements
		StripeEventHandler<typeof StripeEventType.PAYMENT_INTENT_PAYMENT_FAILED>
{
	readonly eventTypes = [
		StripeEventType.PAYMENT_INTENT_PAYMENT_FAILED,
	] as const;

	constructor(private readonly payments: StripePaymentEventService) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.PAYMENT_INTENT_PAYMENT_FAILED>
	): Promise<void> {
		await this.payments.paymentIntentFailed(await event.fetchRelatedObject());
	}
}

@Injectable()
export class PaymentIntentRequiresActionHandler
	implements
		StripeEventHandler<typeof StripeEventType.PAYMENT_INTENT_REQUIRES_ACTION>
{
	readonly eventTypes = [
		StripeEventType.PAYMENT_INTENT_REQUIRES_ACTION,
	] as const;

	constructor(private readonly payments: StripePaymentEventService) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.PAYMENT_INTENT_REQUIRES_ACTION>
	): Promise<void> {
		await this.payments.paymentIntentRequiresAction(
			await event.fetchRelatedObject()
		);
	}
}
