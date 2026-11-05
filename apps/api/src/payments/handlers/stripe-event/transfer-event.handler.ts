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
import { StripeTransferEventService } from '../../services/stripe-event/stripe-transfer-event.service';
import type {
	StripeEventHandler,
	StripeEventOf,
} from '../../types/stripe-event-handler.types';

type TransferChangedEventType =
	| typeof StripeEventType.TRANSFER_CREATED
	| typeof StripeEventType.TRANSFER_UPDATED;

@Injectable()
export class TransferChangedHandler
	implements StripeEventHandler<TransferChangedEventType>
{
	readonly eventTypes = [
		StripeEventType.TRANSFER_CREATED,
		StripeEventType.TRANSFER_UPDATED,
	] as const;

	constructor(private readonly transfers: StripeTransferEventService) {}

	async handle(event: StripeEventOf<TransferChangedEventType>): Promise<void> {
		await this.transfers.transferChanged(await event.fetchRelatedObject());
	}
}

@Injectable()
export class TransferReversedHandler
	implements StripeEventHandler<typeof StripeEventType.TRANSFER_REVERSED>
{
	readonly eventTypes = [StripeEventType.TRANSFER_REVERSED] as const;

	constructor(private readonly transfers: StripeTransferEventService) {}

	async handle(
		event: StripeEventOf<typeof StripeEventType.TRANSFER_REVERSED>
	): Promise<void> {
		await this.transfers.transferReversed(await event.fetchRelatedObject());
	}
}
