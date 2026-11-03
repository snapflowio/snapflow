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
import { StripeDisputeEventService } from '../../services/stripe-event/stripe-dispute-event.service';
import type {
	StripeEventHandler,
	StripeEventOf,
} from '../../types/stripe-event-handler.types';

@Injectable()
export class DisputeCreatedHandler
	implements StripeEventHandler<typeof StripeEventType.CHARGE_DISPUTE_CREATED>
{
	readonly eventTypes = [StripeEventType.CHARGE_DISPUTE_CREATED] as const;

	constructor(private readonly disputes: StripeDisputeEventService) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.CHARGE_DISPUTE_CREATED>
	): Promise<void> {
		await this.disputes.disputeCreated(await event.fetchRelatedObject());
	}
}

type DisputeChangedEventType =
	| typeof StripeEventType.CHARGE_DISPUTE_UPDATED
	| typeof StripeEventType.CHARGE_DISPUTE_FUNDS_WITHDRAWN
	| typeof StripeEventType.CHARGE_DISPUTE_FUNDS_REINSTATED
	| typeof StripeEventType.CHARGE_DISPUTE_CLOSED;

@Injectable()
export class DisputeChangedHandler
	implements StripeEventHandler<DisputeChangedEventType>
{
	readonly eventTypes = [
		StripeEventType.CHARGE_DISPUTE_UPDATED,
		StripeEventType.CHARGE_DISPUTE_FUNDS_WITHDRAWN,
		StripeEventType.CHARGE_DISPUTE_FUNDS_REINSTATED,
		StripeEventType.CHARGE_DISPUTE_CLOSED,
	] as const;

	constructor(private readonly disputes: StripeDisputeEventService) {}

	async handle(event: StripeEventOf<DisputeChangedEventType>): Promise<void> {
		await this.disputes.disputeChanged(await event.fetchRelatedObject());
	}
}

@Injectable()
export class EarlyFraudWarningCreatedHandler
	implements
		StripeEventHandler<typeof StripeEventType.EARLY_FRAUD_WARNING_CREATED>
{
	readonly eventTypes = [StripeEventType.EARLY_FRAUD_WARNING_CREATED] as const;

	constructor(private readonly disputes: StripeDisputeEventService) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.EARLY_FRAUD_WARNING_CREATED>
	): Promise<void> {
		await this.disputes.earlyFraudWarningCreated(
			await event.fetchRelatedObject()
		);
	}
}
