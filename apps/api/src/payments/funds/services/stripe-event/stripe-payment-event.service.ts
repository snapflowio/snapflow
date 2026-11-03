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
import { BillingLedgerService } from '../../../../billing/ledger/services/billing-ledger.service';
import {
	AutoTopUpSuspendedReason,
	TopUpFailureCode,
} from '../../constants/payments.constants';
import {
	STRIPE_CLIENT,
	StripeMetadataKey,
	StripePaymentIntentStatus,
} from '../../constants/stripe.constants';
import { AutoTopUpPolicy } from '../../entities/auto-top-up-policy.entity';
import type { PaymentMethod } from '../../entities/payment-method.entity';
import { TopUp } from '../../entities/top-up.entity';
import { TopUpKind } from '../../enums/top-up-kind.enum';
import {
	PENDING_TOP_UP_STATES,
	TopUpState,
} from '../../enums/top-up-state.enum';
import { chargeFeePosting } from '../../utils/postings/stripe-fee-posting.util';
import { topUpPosting } from '../../utils/postings/top-up-posting.util';
import {
	expandableId,
	stripeAmountMicroUsd,
	stripeTimestamp,
} from '../../utils/stripe-amount.util';
import { AutoTopUpService } from '../auto-top-up.service';
import { PaymentMethodService } from '../payment-method.service';
import { PaymentVelocityService } from '../payment-velocity.service';

const PAYMENT_INTENT_EXPANSIONS = [
	'latest_charge.balance_transaction',
	'payment_method',
];
const CHARGE_EXPANSIONS = ['balance_transaction'];

interface PostedTopUp {
	topUp: TopUp;
	paymentMethod: PaymentMethod | null;
}

const FirstSuccessEffects = {
	APPLY: 'apply',
	SKIP: 'skip',
} as const;

type FirstSuccessEffects =
	(typeof FirstSuccessEffects)[keyof typeof FirstSuccessEffects];

@Injectable()
export class StripePaymentEventService {
	private readonly logger = new Logger(StripePaymentEventService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly ledger: BillingLedgerService,
		private readonly paymentMethods: PaymentMethodService,
		private readonly autoTopUps: AutoTopUpService,
		private readonly velocity: PaymentVelocityService
	) {}

	async paymentIntentSucceeded(notified: Stripe.PaymentIntent): Promise<void> {
		const posted = await this.postTopUp(notified, FirstSuccessEffects.APPLY);
		const fingerprint = posted?.paymentMethod?.cardFingerprint;
		if (fingerprint) await this.velocity.enforceCardFingerprint(fingerprint);
	}

	// Credits a succeeded top-up without the side effects of a first success,
	// for handlers that must see the credit before they change it.
	async ensureTopUpPosted(intent: Stripe.PaymentIntent): Promise<void> {
		await this.postTopUp(intent, FirstSuccessEffects.SKIP);
	}

	async ownedTopUp(intent: Stripe.PaymentIntent): Promise<TopUp | null> {
		const topUpId = intent.metadata[StripeMetadataKey.TOP_UP_ID];
		const organizationId = intent.metadata[StripeMetadataKey.ORGANIZATION_ID];
		if (!topUpId || !organizationId) {
			this.logger.warn(`Payment intent ${intent.id} is not a top-up`);
			return null;
		}
		const topUp = await this.entityManager
			.fork()
			.findOne(TopUp, { id: topUpId });
		if (!topUp) {
			this.logger.warn(
				`Payment intent ${intent.id} references top-up ${topUpId}, which does not exist here`
			);
			return null;
		}
		if (
			topUp.organizationId !== organizationId ||
			(topUp.stripePaymentIntentId !== null &&
				topUp.stripePaymentIntentId !== intent.id)
		) {
			this.logger.error(
				`Payment intent ${intent.id} does not match top-up ${topUp.id} of organization ${topUp.organizationId}`
			);
			return null;
		}
		return topUp;
	}

	async paymentIntentFailed(intent: Stripe.PaymentIntent): Promise<void> {
		await this.updateAutoTopUp(intent, (topUp) => {
			topUp.state = TopUpState.FAILED;
			topUp.failureCode =
				intent.last_payment_error?.code ?? TopUpFailureCode.PAYMENT_ERROR;
		});
	}

	async paymentIntentRequiresAction(
		intent: Stripe.PaymentIntent
	): Promise<void> {
		await this.updateAutoTopUp(intent, async (topUp, manager) => {
			topUp.state = TopUpState.REQUIRES_ACTION;
			await manager.nativeUpdate(
				AutoTopUpPolicy,
				{ organizationId: topUp.organizationId },
				{ suspendedReason: AutoTopUpSuspendedReason.AUTHENTICATION_REQUIRED }
			);
		});
	}

	async checkoutSessionCompleted(
		session: Stripe.Checkout.Session
	): Promise<void> {
		const paymentIntentId = expandableId(session.payment_intent);
		if (!paymentIntentId) return;
		await this.entityManager
			.fork()
			.nativeUpdate(
				TopUp,
				{ stripeCheckoutSessionId: session.id, stripePaymentIntentId: null },
				{ stripePaymentIntentId: paymentIntentId }
			);
	}

	async checkoutSessionExpired(
		session: Stripe.Checkout.Session
	): Promise<void> {
		await this.entityManager
			.fork()
			.nativeUpdate(
				TopUp,
				{ stripeCheckoutSessionId: session.id, state: TopUpState.CREATED },
				{ state: TopUpState.EXPIRED }
			);
	}

	async chargeUpdated(notified: Stripe.Charge): Promise<void> {
		const charge = await this.stripe.charges.retrieve(notified.id, {
			expand: CHARGE_EXPANSIONS,
		});
		await this.entityManager
			.fork()
			.transactional((manager) => this.postChargeFee(manager, charge));
	}

	async paymentMethodDetached(method: Stripe.PaymentMethod): Promise<void> {
		await this.paymentMethods.markDetached(method.id);
	}

	async paymentMethodUpdated(method: Stripe.PaymentMethod): Promise<void> {
		await this.paymentMethods.refresh(method);
	}

	private async postTopUp(
		notified: Stripe.PaymentIntent,
		firstSuccess: FirstSuccessEffects
	): Promise<PostedTopUp | null> {
		const owned = await this.ownedTopUp(notified);
		if (!owned || owned.state === TopUpState.SUCCEEDED) return null;
		const intent = await this.stripe.paymentIntents.retrieve(notified.id, {
			expand: PAYMENT_INTENT_EXPANSIONS,
		});
		if (intent.status !== StripePaymentIntentStatus.SUCCEEDED) {
			throw new Error(
				`Payment intent ${intent.id} is ${intent.status}, not succeeded`
			);
		}
		const taxCents = await this.taxCents(owned);
		return this.entityManager.fork().transactional(async (manager) => {
			const topUp = await manager.findOne(
				TopUp,
				{ id: owned.id },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!topUp || topUp.state === TopUpState.SUCCEEDED) return null;
			const effectiveAt = stripeTimestamp(intent.created);
			await this.ledger.post(
				manager,
				topUpPosting({
					paymentIntentId: intent.id,
					topUpId: topUp.id,
					organizationId: topUp.organizationId,
					grossMicroUsd: stripeAmountMicroUsd(
						intent.amount_received,
						intent.currency
					),
					taxMicroUsd: stripeAmountMicroUsd(taxCents, intent.currency),
					effectiveAt,
				})
			);
			topUp.state = TopUpState.SUCCEEDED;
			topUp.amountCents = intent.amount_received - taxCents;
			topUp.taxCents = taxCents;
			topUp.succeededAt ??= effectiveAt;
			topUp.stripePaymentIntentId ??= intent.id;
			const paymentMethod = await this.recordPaymentMethod(
				manager,
				topUp,
				intent,
				effectiveAt
			);
			topUp.paymentMethodId ??= paymentMethod?.id ?? null;
			await this.postChargeFee(manager, intent.latest_charge);
			if (firstSuccess === FirstSuccessEffects.APPLY) {
				await this.autoTopUps.recordSuccess(manager, topUp);
			}
			return { topUp, paymentMethod };
		});
	}

	private async taxCents(topUp: TopUp): Promise<number> {
		if (!topUp.stripeCheckoutSessionId) return topUp.taxCents;
		const session = await this.stripe.checkout.sessions.retrieve(
			topUp.stripeCheckoutSessionId
		);
		return session.total_details?.amount_tax ?? 0;
	}

	private async recordPaymentMethod(
		manager: EntityManager,
		topUp: TopUp,
		intent: Stripe.PaymentIntent,
		chargedAt: Date
	): Promise<PaymentMethod | null> {
		const paymentMethod = intent.payment_method;
		if (!paymentMethod || typeof paymentMethod === 'string') return null;
		return this.paymentMethods.record(
			manager,
			topUp.organizationId,
			intent.customer_account,
			paymentMethod,
			chargedAt
		);
	}

	private async postChargeFee(
		manager: EntityManager,
		charge: Stripe.PaymentIntent['latest_charge']
	): Promise<void> {
		if (!charge || typeof charge === 'string') return;
		const transaction = charge.balance_transaction;
		if (!transaction || typeof transaction === 'string') return;
		if (transaction.fee <= 0) return;
		await this.ledger.post(
			manager,
			chargeFeePosting({
				balanceTransactionId: transaction.id,
				chargeId: charge.id,
				feeMicroUsd: stripeAmountMicroUsd(
					transaction.fee,
					transaction.currency
				),
				effectiveAt: stripeTimestamp(transaction.created),
			})
		);
	}

	private async updateAutoTopUp(
		intent: Stripe.PaymentIntent,
		change: (topUp: TopUp, manager: EntityManager) => void | Promise<void>
	): Promise<void> {
		const topUpId = intent.metadata[StripeMetadataKey.TOP_UP_ID];
		if (!topUpId) return;
		await this.entityManager.fork().transactional(async (manager) => {
			const topUp = await manager.findOne(
				TopUp,
				{
					id: topUpId,
					kind: TopUpKind.AUTO,
					state: { $in: [...PENDING_TOP_UP_STATES] },
				},
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!topUp) return;
			topUp.stripePaymentIntentId ??= intent.id;
			await change(topUp, manager);
		});
	}
}
