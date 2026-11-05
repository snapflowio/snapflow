/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type Stripe from 'stripe';
import {
	type BillingLedgerPosting,
	BillingLedgerService,
} from '../../../billing/services/billing-ledger.service';
import {
	type PlatformPayoutPostingInput,
	platformPayoutCreatedPosting,
	platformPayoutFailedPosting,
	platformPayoutPaidPosting,
} from '../../utils/postings/payout-posting.util';
import {
	stripeAmountMicroUsd,
	stripeTimestamp,
} from '../../utils/stripe-amount.util';

@Injectable()
export class StripePayoutEventService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly ledger: BillingLedgerService
	) {}

	payoutCreated(payout: Stripe.Payout): Promise<void> {
		return this.post(
			platformPayoutCreatedPosting(this.input(payout, payout.created))
		);
	}

	payoutPaid(payout: Stripe.Payout): Promise<void> {
		return this.post(
			platformPayoutPaidPosting(this.input(payout, payout.arrival_date))
		);
	}

	payoutFailed(payout: Stripe.Payout): Promise<void> {
		return this.post(
			platformPayoutFailedPosting(this.input(payout, payout.arrival_date))
		);
	}

	private input(
		payout: Stripe.Payout,
		effectiveSeconds: number
	): PlatformPayoutPostingInput {
		return {
			stripePayoutId: payout.id,
			amountMicroUsd: stripeAmountMicroUsd(payout.amount, payout.currency),
			effectiveAt: stripeTimestamp(effectiveSeconds),
		};
	}

	private async post(posting: BillingLedgerPosting): Promise<void> {
		await this.entityManager
			.fork()
			.transactional((manager) => this.ledger.post(manager, posting));
	}
}
