/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { BillingLedgerService } from '../../../billing/services/billing-ledger.service';
import { PAYOUT_TRANSFER_PAGE_SIZE } from '../../constants/payments.constants';
import {
	STRIPE_CLIENT,
	StripeMetadataKey,
} from '../../constants/stripe.constants';
import { Payout } from '../../entities/payout.entity';
import { payoutReversalPosting } from '../../utils/postings/payout-posting.util';
import {
	stripeAmountMicroUsd,
	stripeTimestamp,
} from '../../utils/stripe-amount.util';
import { PayoutService } from '../payout.service';

@Injectable()
export class StripeTransferEventService {
	private readonly logger = new Logger(StripeTransferEventService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly ledger: BillingLedgerService,
		private readonly payouts: PayoutService
	) {}

	async transferChanged(transfer: Stripe.Transfer): Promise<void> {
		await this.payouts.confirmTransfer(transfer);
	}

	// A reversed transfer returns the money to the platform balance and back to
	// the host's payable earnings, one posting per reversal.
	async transferReversed(transfer: Stripe.Transfer): Promise<void> {
		const payoutId = transfer.metadata[StripeMetadataKey.PAYOUT_ID];
		const payout = payoutId
			? await this.entityManager.fork().findOne(Payout, { id: payoutId })
			: null;
		if (!payout) {
			this.logger.error(
				`Transfer ${transfer.id} was reversed by ${transfer.amount_reversed} cents but belongs to no Snapflow payout`
			);
			return;
		}
		for await (const reversal of this.stripe.transfers.listReversals(
			transfer.id,
			{ limit: PAYOUT_TRANSFER_PAGE_SIZE }
		)) {
			await this.entityManager.fork().transactional((manager) =>
				this.ledger.post(
					manager,
					payoutReversalPosting({
						payoutId: payout.id,
						organizationId: payout.organizationId,
						transferId: transfer.id,
						reversalId: reversal.id,
						amountMicroUsd: stripeAmountMicroUsd(
							reversal.amount,
							reversal.currency
						),
						effectiveAt: stripeTimestamp(reversal.created),
					})
				)
			);
		}
	}
}
