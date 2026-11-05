/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { LockMode, RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
	isStripeObjectMissing,
	stripeErrorDetails,
} from '../../common/utils/error/stripe-error.util';
import { addMinutes } from '../../common/utils/time.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import {
	AUTO_TOP_UP_BATCH_SIZE,
	AUTO_TOP_UP_MAXIMUM_CONSECUTIVE_FAILURES,
	AutoTopUpSuspendedReason,
	TopUpFailureCode,
} from '../constants/payments.constants';
import {
	STRIPE_CLIENT,
	STRIPE_CURRENCY,
	STRIPE_IDEMPOTENCY_SAFE_MILLISECONDS,
	StripeDeclineCode,
	StripeIdempotencyPrefix,
	StripeMetadataKey,
	StripePaymentIntentStatus,
	StripeRequestParam,
} from '../constants/stripe.constants';
import { AutoTopUpPolicy } from '../entities/auto-top-up-policy.entity';
import { PaymentAccount } from '../entities/payment-account.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { TopUp } from '../entities/top-up.entity';
import { TopUpKind } from '../enums/top-up-kind.enum';
import { PENDING_TOP_UP_STATES, TopUpState } from '../enums/top-up-state.enum';
import {
	autoTopUpCandidates,
	spendableCredit,
} from '../queries/auto-top-up.query';
import {
	idempotencyKey,
	stripeMetadataQuery,
} from '../utils/stripe-amount.util';
import {
	AutoTopUpTaxLocationError,
	AutoTopUpTaxService,
	NO_TAX,
} from './auto-top-up-tax.service';
import { PaymentMethodService } from './payment-method.service';
import { StripePaymentEventService } from './stripe-event/stripe-payment-event.service';

interface AutoTopUpAttempt {
	topUp: TopUp;
	policy: AutoTopUpPolicy;
	paymentMethod: PaymentMethod;
	account: PaymentAccount;
}

const FAILED_PAYMENT_INTENT_STATUSES: readonly Stripe.PaymentIntent.Status[] = [
	StripePaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
	StripePaymentIntentStatus.CANCELED,
];

@Injectable()
export class AutoTopUpChargeService {
	private readonly logger = new Logger(AutoTopUpChargeService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly settings: SettingsService,
		private readonly tax: AutoTopUpTaxService,
		private readonly payments: StripePaymentEventService,
		private readonly paymentMethods: PaymentMethodService
	) {}

	async runDue(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const settings = await this.settings.get();
			const now = await databaseNow(this.entityManager);
			const attemptedBefore = addMinutes(
				now,
				-settings.autoTopUpMinimumIntervalMinutes
			);
			const candidates = await autoTopUpCandidates(
				this.entityManager,
				attemptedBefore,
				AUTO_TOP_UP_BATCH_SIZE
			);
			for (const candidate of candidates) {
				const spendable = await spendableCredit(
					this.entityManager,
					candidate.organizationId
				);
				if (spendable.atLeast(MicroUsd.fromCents(candidate.thresholdCents))) {
					continue;
				}
				try {
					await this.topUp(
						candidate.organizationId,
						attemptedBefore,
						settings.stripeTaxEnabled
					);
				} catch (error) {
					this.logger.error(
						`Automatic top-up of ${candidate.organizationId} failed: ${stripeErrorDetails(error)}`
					);
				}
			}
		});
	}

	// An organization never has two automatic charges in flight: a pending one
	// is settled from Stripe first.
	private async topUp(
		organizationId: string,
		attemptedBefore: Date,
		taxEnabled: boolean
	): Promise<void> {
		const pending = await this.entityManager.fork().findOne(
			TopUp,
			{
				organizationId,
				kind: TopUpKind.AUTO,
				state: { $in: [...PENDING_TOP_UP_STATES] },
			},
			{ orderBy: { createdAt: 'DESC', id: 'DESC' } }
		);
		if (pending) {
			await this.settlePending(pending, taxEnabled);
			return;
		}
		const attempt = await this.begin(organizationId, attemptedBefore);
		if (attempt) await this.charge(attempt, taxEnabled);
	}

	private async settlePending(
		topUp: TopUp,
		taxEnabled: boolean
	): Promise<void> {
		const intent = await this.findIntent(topUp);
		if (intent) {
			if (intent.status === StripePaymentIntentStatus.SUCCEEDED) {
				await this.payments.paymentIntentSucceeded(intent);
			} else if (
				intent.status === StripePaymentIntentStatus.REQUIRES_ACTION &&
				topUp.state === TopUpState.CREATED
			) {
				await this.payments.paymentIntentRequiresAction(intent);
			} else if (FAILED_PAYMENT_INTENT_STATUSES.includes(intent.status)) {
				await this.payments.paymentIntentFailed(intent);
			}
			return;
		}
		const now = await databaseNow(this.entityManager);
		if (
			topUp.state === TopUpState.CREATED &&
			now.getTime() - topUp.createdAt.getTime() <
				STRIPE_IDEMPOTENCY_SAFE_MILLISECONDS
		) {
			const attempt = await this.resumeAttempt(topUp);
			if (attempt) await this.charge(attempt, taxEnabled);
			return;
		}
		this.logger.error(
			`Automatic top-up ${topUp.id} never got a payment intent; it is abandoned`
		);
		await this.entityManager
			.fork()
			.nativeUpdate(
				TopUp,
				{ id: topUp.id, state: { $in: [...PENDING_TOP_UP_STATES] } },
				{ state: TopUpState.FAILED, failureCode: TopUpFailureCode.ABANDONED }
			);
	}

	// An attempt interrupted before it stored its payment intent may still have
	// created one, so Stripe is searched before the charge is sent again.
	private async findIntent(topUp: TopUp): Promise<Stripe.PaymentIntent | null> {
		if (topUp.stripePaymentIntentId) {
			return this.stripe.paymentIntents.retrieve(topUp.stripePaymentIntentId);
		}
		const found = await this.stripe.paymentIntents.search({
			query: stripeMetadataQuery(StripeMetadataKey.TOP_UP_ID, topUp.id),
		});
		return found.data[0] ?? null;
	}

	private begin(
		organizationId: string,
		attemptedBefore: Date
	): Promise<AutoTopUpAttempt | null> {
		return this.entityManager.fork().transactional(async (manager) => {
			const policy = await manager.findOne(
				AutoTopUpPolicy,
				{ organizationId, enabled: true, suspendedReason: null },
				{ lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE }
			);
			if (
				!policy ||
				(policy.lastAttemptAt && policy.lastAttemptAt > attemptedBefore)
			) {
				return null;
			}
			const now = await databaseNow(manager);
			const topUp = Object.assign(new TopUp(), {
				id: randomUUID(),
				organizationId,
				kind: TopUpKind.AUTO,
				amountCents: policy.amountCents,
				paymentMethodId: policy.paymentMethodId,
				createdAt: now,
			});
			manager.persist(topUp);
			await manager.nativeUpdate(
				AutoTopUpPolicy,
				{ organizationId },
				{ lastAttemptAt: now }
			);
			return this.attempt(manager, topUp, policy);
		});
	}

	private resumeAttempt(topUp: TopUp): Promise<AutoTopUpAttempt | null> {
		return this.entityManager.fork().transactional(async (manager) => {
			const policy = await manager.findOne(
				AutoTopUpPolicy,
				{ organizationId: topUp.organizationId },
				{ lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE }
			);
			return policy ? this.attempt(manager, topUp, policy) : null;
		});
	}

	private async attempt(
		manager: EntityManager,
		topUp: TopUp,
		policy: AutoTopUpPolicy
	): Promise<AutoTopUpAttempt> {
		const paymentMethod = await manager.findOneOrFail(PaymentMethod, {
			id: topUp.paymentMethodId ?? policy.paymentMethodId,
		});
		const account = await manager.findOneOrFail(PaymentAccount, {
			organizationId: topUp.organizationId,
		});
		return { topUp, policy, paymentMethod, account };
	}

	// The tax is stored before the charge, so a success webhook that outruns
	// the response never credits the tax to the customer.
	private async charge(
		attempt: AutoTopUpAttempt,
		taxEnabled: boolean
	): Promise<void> {
		const { topUp, paymentMethod, account } = attempt;
		try {
			const tax = taxEnabled ? await this.tax.quote(account, topUp) : NO_TAX;
			await this.entityManager
				.fork()
				.nativeUpdate(TopUp, { id: topUp.id }, { taxCents: tax.taxCents });
			const intent = await this.stripe.paymentIntents.create(
				{
					amount: topUp.amountCents + tax.taxCents,
					currency: STRIPE_CURRENCY,
					customer_account: account.stripeAccountId,
					payment_method: paymentMethod.stripePaymentMethodId,
					off_session: true,
					confirm: true,
					metadata: {
						[StripeMetadataKey.TOP_UP_ID]: topUp.id,
						[StripeMetadataKey.ORGANIZATION_ID]: topUp.organizationId,
						[StripeMetadataKey.TOP_UP_KIND]: TopUpKind.AUTO,
					},
					...(tax.calculationId
						? { hooks: { inputs: { tax: { calculation: tax.calculationId } } } }
						: {}),
				},
				{
					idempotencyKey: idempotencyKey(
						StripeIdempotencyPrefix.TOP_UP,
						topUp.id
					),
				}
			);
			await this.entityManager
				.fork()
				.nativeUpdate(
					TopUp,
					{ id: topUp.id, stripePaymentIntentId: null },
					{ stripePaymentIntentId: intent.id }
				);
		} catch (error) {
			await this.recordFailure(attempt, error);
		}
	}

	private async recordFailure(
		attempt: AutoTopUpAttempt,
		error: unknown
	): Promise<void> {
		const { topUp } = attempt;
		const manager = this.entityManager.fork();
		if (error instanceof Stripe.errors.StripeCardError) {
			if (
				error.code === StripeDeclineCode.AUTHENTICATION_REQUIRED ||
				error.decline_code === StripeDeclineCode.AUTHENTICATION_REQUIRED
			) {
				await manager.nativeUpdate(
					TopUp,
					{ id: topUp.id },
					{
						state: TopUpState.REQUIRES_ACTION,
						stripePaymentIntentId: error.payment_intent?.id ?? null,
					}
				);
				await manager.nativeUpdate(
					AutoTopUpPolicy,
					{ organizationId: topUp.organizationId },
					{ suspendedReason: AutoTopUpSuspendedReason.AUTHENTICATION_REQUIRED }
				);
				return;
			}
			await this.fail(
				manager,
				attempt,
				error.decline_code ?? error.code ?? TopUpFailureCode.PAYMENT_ERROR,
				error.payment_intent?.id ?? null
			);
			return;
		}
		if (
			isStripeObjectMissing(error, StripeRequestParam.CUSTOMER_ACCOUNT) ||
			isStripeObjectMissing(error, StripeRequestParam.PAYMENT_METHOD)
		) {
			this.logger.warn(
				`Automatic top-up ${topUp.id} lost its card: ${stripeErrorDetails(error)}`
			);
			await this.paymentMethods.markDetached(
				attempt.paymentMethod.stripePaymentMethodId
			);
		}
		if (
			error instanceof AutoTopUpTaxLocationError ||
			error instanceof Stripe.errors.StripeInvalidRequestError
		) {
			await this.fail(
				manager,
				attempt,
				error instanceof AutoTopUpTaxLocationError
					? TopUpFailureCode.TAX_LOCATION_UNAVAILABLE
					: (error.code ?? TopUpFailureCode.PAYMENT_ERROR),
				null
			);
			return;
		}
		throw error;
	}

	private async fail(
		manager: EntityManager,
		attempt: AutoTopUpAttempt,
		failureCode: string,
		paymentIntentId: string | null
	): Promise<void> {
		const failures = attempt.policy.consecutiveFailures + 1;
		await manager.nativeUpdate(
			TopUp,
			{ id: attempt.topUp.id },
			{
				state: TopUpState.FAILED,
				failureCode,
				...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
			}
		);
		await manager.nativeUpdate(
			AutoTopUpPolicy,
			{ organizationId: attempt.topUp.organizationId },
			failures >= AUTO_TOP_UP_MAXIMUM_CONSECUTIVE_FAILURES
				? {
						consecutiveFailures: failures,
						enabled: false,
						suspendedReason: AutoTopUpSuspendedReason.CONSECUTIVE_FAILURES,
					}
				: { consecutiveFailures: failures }
		);
	}
}
