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
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { PaymentSuspensionReason } from '../../constants/payments.constants';
import { STRIPE_CLIENT } from '../../constants/stripe.constants';
import { PaymentDispute } from '../../entities/payment-dispute.entity';
import { DisputeState } from '../../enums/dispute-state.enum';
import { spendableCredit } from '../../queries/auto-top-up.query';
import {
	disputeFreezePosting,
	disputeLossPosting,
	disputeReinstatementPosting,
	disputeWithdrawalPosting,
} from '../../utils/postings/dispute-posting.util';
import { expandableId, stripeTimestamp } from '../../utils/stripe-amount.util';
import {
	disputeClosed,
	disputedTotal,
	disputeFreezeMicroUsd,
	disputeLossMicroUsd,
	disputeReinstatements,
	disputeState,
	disputeWithdrawals,
	shouldFreezeDisputedCredit,
} from '../../utils/stripe-dispute.util';
import { PaymentSuspensionService } from '../payment-suspension.service';
import { StripePaymentEventService } from './stripe-payment-event.service';

interface ChargeOwner {
	organizationId: string;
	topUpId: string;
	paymentIntent: Stripe.PaymentIntent;
}

const CHARGE_EXPANSIONS = ['payment_intent'];

@Injectable()
export class StripeDisputeEventService {
	private readonly logger = new Logger(StripeDisputeEventService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly ledger: BillingLedgerService,
		private readonly suspensions: PaymentSuspensionService,
		private readonly payments: StripePaymentEventService
	) {}

	async disputeCreated(dispute: Stripe.Dispute): Promise<void> {
		const owner = await this.sync(dispute);
		if (!owner) return;
		await this.suspensions.suspend(
			owner.organizationId,
			PaymentSuspensionReason.PAYMENT_DISPUTE,
			{ stripeDisputeId: dispute.id }
		);
	}

	async disputeChanged(dispute: Stripe.Dispute): Promise<void> {
		await this.sync(dispute);
	}

	async earlyFraudWarningCreated(
		warning: Stripe.Radar.EarlyFraudWarning
	): Promise<void> {
		const chargeId = expandableId(warning.charge);
		const owner = chargeId ? await this.chargeOwner(chargeId) : null;
		if (!owner) return;
		await this.suspensions.suspend(
			owner.organizationId,
			PaymentSuspensionReason.EARLY_FRAUD_WARNING,
			{ earlyFraudWarningId: warning.id }
		);
	}

	// Every dispute event resyncs the ledger from the current Stripe dispute, so
	// events may arrive in any order and replay without double posting.
	private async sync(dispute: Stripe.Dispute): Promise<ChargeOwner | null> {
		const chargeId = expandableId(dispute.charge);
		const owner = chargeId ? await this.chargeOwner(chargeId) : null;
		if (!owner) {
			this.logger.error(`Dispute ${dispute.id} has no Snapflow top-up`);
			return null;
		}
		if (dispute.balance_transactions.length > 0) {
			await this.payments.ensureTopUpPosted(owner.paymentIntent);
		}
		await this.entityManager.fork().transactional(async (manager) => {
			const record = await this.record(manager, dispute, owner);
			await this.syncLedger(manager, dispute, record);
		});
		return owner;
	}

	private async syncLedger(
		manager: EntityManager,
		dispute: Stripe.Dispute,
		record: PaymentDispute
	): Promise<void> {
		const transactions = dispute.balance_transactions;
		const withdrawals = disputeWithdrawals(transactions);
		for (const withdrawal of withdrawals) {
			await this.ledger.post(
				manager,
				disputeWithdrawalPosting({
					disputeId: dispute.id,
					organizationId: record.organizationId,
					...withdrawal,
				})
			);
		}
		if (
			shouldFreezeDisputedCredit(transactions, record.state) &&
			!(await this.frozen(manager, dispute.id))
		) {
			await this.freeze(manager, dispute, record);
		}
		const reinstatements = disputeReinstatements(
			transactions,
			MicroUsd.parse(record.frozenMicroUsd)
		);
		for (const reinstatement of reinstatements) {
			await this.ledger.post(
				manager,
				disputeReinstatementPosting({
					disputeId: dispute.id,
					organizationId: record.organizationId,
					...reinstatement,
				})
			);
		}
		if (record.state !== DisputeState.LOST) return;
		const lostMicroUsd = disputeLossMicroUsd(
			transactions,
			MicroUsd.parse(record.frozenMicroUsd)
		);
		if (!lostMicroUsd.isPositive()) return;
		await this.ledger.post(
			manager,
			disputeLossPosting({
				disputeId: dispute.id,
				organizationId: record.organizationId,
				lostMicroUsd,
				effectiveAt: stripeTimestamp(dispute.created),
			})
		);
	}

	private async freeze(
		manager: EntityManager,
		dispute: Stripe.Dispute,
		record: PaymentDispute
	): Promise<void> {
		const frozenMicroUsd = disputeFreezeMicroUsd(
			disputedTotal(dispute.balance_transactions),
			await spendableCredit(manager, record.organizationId)
		);
		if (!frozenMicroUsd.isPositive()) return;
		await this.ledger.post(
			manager,
			disputeFreezePosting({
				disputeId: dispute.id,
				organizationId: record.organizationId,
				frozenMicroUsd,
				effectiveAt: stripeTimestamp(dispute.created),
			})
		);
		record.frozenMicroUsd = frozenMicroUsd.toString();
	}

	private async record(
		manager: EntityManager,
		dispute: Stripe.Dispute,
		owner: ChargeOwner
	): Promise<PaymentDispute> {
		const existing = await manager.findOne(
			PaymentDispute,
			{ stripeDisputeId: dispute.id },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		const record = existing ?? new PaymentDispute();
		if (!existing) {
			record.stripeDisputeId = dispute.id;
			record.organizationId = owner.organizationId;
			record.topUpId = owner.topUpId;
			record.createdAt = stripeTimestamp(dispute.created);
			manager.persist(record);
		}
		const state = disputeState(dispute.status);
		record.amountCents = dispute.amount;
		record.state = state;
		record.reason = dispute.reason;
		const dueBy = dispute.evidence_details?.due_by;
		record.evidenceDueBy = dueBy ? stripeTimestamp(dueBy) : null;
		record.closedAt = disputeClosed(state)
			? (record.closedAt ?? (await databaseNow(manager)))
			: null;
		return record;
	}

	private async chargeOwner(chargeId: string): Promise<ChargeOwner | null> {
		const charge = await this.stripe.charges.retrieve(chargeId, {
			expand: CHARGE_EXPANSIONS,
		});
		const intent = charge.payment_intent;
		if (!intent || typeof intent === 'string') return null;
		const topUp = await this.payments.ownedTopUp(intent);
		if (!topUp) return null;
		return {
			organizationId: topUp.organizationId,
			topUpId: topUp.id,
			paymentIntent: intent,
		};
	}

	private async frozen(
		manager: EntityManager,
		disputeId: string
	): Promise<boolean> {
		const count = await manager.count(BillingLedgerTransaction, {
			sourceType: BillingLedgerSourceType.STRIPE_DISPUTE_FREEZE,
			sourceReference: disputeId,
			sourceVersion: BILLING_LEDGER_SOURCE_VERSION,
		});
		return count > 0;
	}
}
