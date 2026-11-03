/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
	BILLING_LEDGER_SOURCE_VERSION,
	BillingLedgerSourceType,
} from '../../../../billing/ledger/constants/billing.constants';
import { BillingLedgerTransaction } from '../../../../billing/ledger/entities/billing-ledger-transaction.entity';
import { BillingLedgerService } from '../../../../billing/ledger/services/billing-ledger.service';
import {
	STRIPE_CLIENT,
	StripeRefundStatus,
} from '../../constants/stripe.constants';
import { TopUp } from '../../entities/top-up.entity';
import { spendableCredit } from '../../queries/auto-top-up.query';
import {
	type RefundPostingInput,
	refundFailurePosting,
	refundPosting,
} from '../../utils/postings/refund-posting.util';
import { stripeTimestamp } from '../../utils/stripe-amount.util';
import {
	type RefundSplit,
	refundSplit,
	refundSplitFromMetadata,
} from '../../utils/stripe-refund.util';
import { StripePaymentEventService } from './stripe-payment-event.service';

const REFUND_EXPANSIONS = ['payment_intent', 'failure_balance_transaction'];

@Injectable()
export class StripeRefundEventService {
	private readonly logger = new Logger(StripeRefundEventService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly ledger: BillingLedgerService,
		private readonly payments: StripePaymentEventService
	) {}

	// A refund moves Stripe balance once it has a balance transaction; a failed
	// refund returns it. Both are posted once per refund id.
	async refundChanged(notified: Stripe.Refund): Promise<void> {
		const refund = await this.stripe.refunds.retrieve(notified.id, {
			expand: REFUND_EXPANSIONS,
		});
		if (!refund.balance_transaction) return;
		const intent = refund.payment_intent;
		if (!intent || typeof intent === 'string') {
			this.logger.warn(`Refund ${refund.id} has no payment intent`);
			return;
		}
		const owned = await this.payments.ownedTopUp(intent);
		if (!owned) return;
		await this.payments.ensureTopUpPosted(intent);
		await this.entityManager.fork().transactional(async (manager) => {
			const topUp = await manager.findOneOrFail(
				TopUp,
				{ id: owned.id },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			const posting = {
				refundId: refund.id,
				paymentIntentId: intent.id,
				topUpId: topUp.id,
				organizationId: topUp.organizationId,
			};
			const split = await this.postRefund(manager, refund, topUp, posting);
			if (refund.status !== StripeRefundStatus.FAILED) return;
			await this.ledger.post(
				manager,
				refundFailurePosting({
					...posting,
					split,
					effectiveAt: this.failedAt(refund),
				})
			);
		});
	}

	private async postRefund(
		manager: EntityManager,
		refund: Stripe.Refund,
		topUp: TopUp,
		posting: Omit<RefundPostingInput, 'split' | 'effectiveAt'>
	): Promise<RefundSplit> {
		const posted = await manager.findOne(BillingLedgerTransaction, {
			sourceType: BillingLedgerSourceType.STRIPE_REFUND,
			sourceReference: refund.id,
			sourceVersion: BILLING_LEDGER_SOURCE_VERSION,
		});
		if (posted) return refundSplitFromMetadata(posted.metadata);
		const split = refundSplit(
			refund.amount,
			refund.currency,
			topUp,
			await spendableCredit(manager, topUp.organizationId)
		);
		await this.ledger.post(
			manager,
			refundPosting({
				...posting,
				split,
				effectiveAt: stripeTimestamp(refund.created),
			})
		);
		return split;
	}

	private failedAt(refund: Stripe.Refund): Date {
		const failure = refund.failure_balance_transaction;
		return stripeTimestamp(
			failure && typeof failure !== 'string' ? failure.created : refund.created
		);
	}
}
