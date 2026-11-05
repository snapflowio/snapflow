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
import { StripeEventScope } from '../../enums/stripe-event-scope.enum';
import { StripeAccountEventService } from '../../services/stripe-event/stripe-account-event.service';
import { StripePayoutEventService } from '../../services/stripe-event/stripe-payout-event.service';
import type {
	StripeEventHandler,
	StripeEventOf,
} from '../../types/stripe-event-handler.types';
import { connectedAccountContext } from '../../utils/stripe-event.util';

@Injectable()
export class PayoutCreatedHandler
	implements StripeEventHandler<typeof StripeEventType.PAYOUT_CREATED>
{
	readonly eventTypes = [StripeEventType.PAYOUT_CREATED] as const;

	constructor(private readonly payouts: StripePayoutEventService) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.PAYOUT_CREATED>,
		scope: StripeEventScope
	): Promise<void> {
		if (scope !== StripeEventScope.PLATFORM) return;
		await this.payouts.payoutCreated(await event.fetchRelatedObject());
	}
}

@Injectable()
export class PayoutPaidHandler
	implements StripeEventHandler<typeof StripeEventType.PAYOUT_PAID>
{
	readonly eventTypes = [StripeEventType.PAYOUT_PAID] as const;

	constructor(
		private readonly payouts: StripePayoutEventService,
		private readonly accounts: StripeAccountEventService
	) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.PAYOUT_PAID>,
		scope: StripeEventScope
	): Promise<void> {
		if (scope === StripeEventScope.PLATFORM) {
			await this.payouts.payoutPaid(await event.fetchRelatedObject());
			return;
		}
		await this.accounts.connectedPayoutPaid(connectedAccountContext(event));
	}
}

@Injectable()
export class PayoutFailedHandler
	implements StripeEventHandler<typeof StripeEventType.PAYOUT_FAILED>
{
	readonly eventTypes = [StripeEventType.PAYOUT_FAILED] as const;

	constructor(
		private readonly payouts: StripePayoutEventService,
		private readonly accounts: StripeAccountEventService
	) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.PAYOUT_FAILED>,
		scope: StripeEventScope
	): Promise<void> {
		if (scope === StripeEventScope.PLATFORM) {
			await this.payouts.payoutFailed(await event.fetchRelatedObject());
			return;
		}
		await this.accounts.connectedPayoutFailed(connectedAccountContext(event));
	}
}
