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
import { StripeAccountEventService } from '../../services/stripe-event/stripe-account-event.service';
import type {
	StripeEventHandler,
	StripeEventOf,
} from '../../types/stripe-event-handler.types';
import { connectedAccountContext } from '../../utils/stripe-event.util';

@Injectable()
export class ExternalAccountUpdatedHandler
	implements StripeEventHandler<typeof StripeEventType.EXTERNAL_ACCOUNT_UPDATED>
{
	readonly eventTypes = [StripeEventType.EXTERNAL_ACCOUNT_UPDATED] as const;

	constructor(private readonly accounts: StripeAccountEventService) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.EXTERNAL_ACCOUNT_UPDATED>
	): Promise<void> {
		await this.accounts.externalAccountUpdated(connectedAccountContext(event));
	}
}

type AccountChangedEventType =
	| typeof StripeEventType.ACCOUNT_REQUIREMENTS_UPDATED
	| typeof StripeEventType.ACCOUNT_RECIPIENT_CAPABILITY_STATUS_UPDATED
	| typeof StripeEventType.ACCOUNT_CLOSED;

@Injectable()
export class AccountChangedHandler
	implements StripeEventHandler<AccountChangedEventType>
{
	readonly eventTypes = [
		StripeEventType.ACCOUNT_REQUIREMENTS_UPDATED,
		StripeEventType.ACCOUNT_RECIPIENT_CAPABILITY_STATUS_UPDATED,
		StripeEventType.ACCOUNT_CLOSED,
	] as const;

	constructor(private readonly accounts: StripeAccountEventService) {}

	async handle(event: StripeEventOf<AccountChangedEventType>): Promise<void> {
		await this.accounts.accountChanged(event.related_object.id);
	}
}
