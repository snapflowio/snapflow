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
import { StripeRefundEventService } from '../../services/stripe-event/stripe-refund-event.service';
import type {
	StripeEventHandler,
	StripeEventOf,
} from '../../types/stripe-event-handler.types';

type RefundChangedEventType =
	| typeof StripeEventType.REFUND_CREATED
	| typeof StripeEventType.REFUND_UPDATED
	| typeof StripeEventType.REFUND_FAILED;

@Injectable()
export class RefundChangedHandler
	implements StripeEventHandler<RefundChangedEventType>
{
	readonly eventTypes = [
		StripeEventType.REFUND_CREATED,
		StripeEventType.REFUND_UPDATED,
		StripeEventType.REFUND_FAILED,
	] as const;

	constructor(private readonly refunds: StripeRefundEventService) {}

	async handle(event: StripeEventOf<RefundChangedEventType>): Promise<void> {
		await this.refunds.refundChanged(await event.fetchRelatedObject());
	}
}
