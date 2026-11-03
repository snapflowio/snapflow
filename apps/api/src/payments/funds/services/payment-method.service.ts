/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { isStripeObjectMissing } from '../../../common/utils/error/stripe-error.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { AutoTopUpSuspendedReason } from '../constants/payments.constants';
import {
	STRIPE_CLIENT,
	STRIPE_SAVED_PAYMENT_METHOD_REDISPLAY,
} from '../constants/stripe.constants';
import { PaymentMethodDto } from '../dto/payment-method.dto';
import { AutoTopUpPolicy } from '../entities/auto-top-up-policy.entity';
import { PaymentMethod } from '../entities/payment-method.entity';

type StripeCard = NonNullable<Stripe.PaymentMethod['card']>;

function savedTo(
	remote: Stripe.PaymentMethod,
	customerAccountId: string | null
): boolean {
	return (
		customerAccountId !== null &&
		remote.customer_account === customerAccountId &&
		remote.allow_redisplay === STRIPE_SAVED_PAYMENT_METHOD_REDISPLAY
	);
}

@Injectable()
export class PaymentMethodService {
	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe
	) {}

	async list(organizationId: string): Promise<PaymentMethodDto[]> {
		const methods = await this.entityManager.find(
			PaymentMethod,
			{ organizationId, detachedAt: null },
			{ orderBy: { createdAt: 'DESC', id: 'DESC' } }
		);
		return methods.map((method) => PaymentMethodDto.from(method));
	}

	async findActive(
		manager: EntityManager,
		organizationId: string,
		paymentMethodId: string
	): Promise<PaymentMethod> {
		const method = await manager.findOne(PaymentMethod, {
			id: paymentMethodId,
			organizationId,
			detachedAt: null,
		});
		if (!method) {
			throw new NotFoundException(
				`Payment method ${paymentMethodId} not found`
			);
		}
		return method;
	}

	async delete(organizationId: string, paymentMethodId: string): Promise<void> {
		const method = await this.findActive(
			this.entityManager.fork(),
			organizationId,
			paymentMethodId
		);
		if (await this.attached(method.stripePaymentMethodId)) {
			await this.stripe.paymentMethods.detach(method.stripePaymentMethodId);
		}
		await this.markDetached(method.stripePaymentMethodId);
	}

	// Every charged card is recorded so card velocity and shared-card checks see
	// it, but only a card the customer saved to its account can be reused.
	async record(
		manager: EntityManager,
		organizationId: string,
		customerAccountId: string | null,
		remote: Stripe.PaymentMethod,
		chargedAt: Date
	): Promise<PaymentMethod | null> {
		const card = remote.card;
		if (!card?.fingerprint) return null;
		const existing = await manager.findOne(PaymentMethod, {
			stripePaymentMethodId: remote.id,
		});
		const method = existing ?? new PaymentMethod();
		if (!existing) {
			method.organizationId = organizationId;
			method.stripePaymentMethodId = remote.id;
			method.createdAt = chargedAt;
			method.detachedAt = savedTo(remote, customerAccountId) ? null : chargedAt;
			manager.persist(method);
		}
		this.applyCard(method, card, card.fingerprint);
		method.firstChargedAt ??= chargedAt;
		return method;
	}

	async refresh(remote: Stripe.PaymentMethod): Promise<void> {
		const card = remote.card;
		const fingerprint = card?.fingerprint;
		if (!card || !fingerprint) return;
		await this.entityManager.transactional(async (manager) => {
			const method = await manager.findOne(PaymentMethod, {
				stripePaymentMethodId: remote.id,
			});
			if (method) this.applyCard(method, card, fingerprint);
		});
	}

	async markDetached(stripePaymentMethodId: string): Promise<void> {
		await this.entityManager.transactional(async (manager) => {
			const method = await manager.findOne(PaymentMethod, {
				stripePaymentMethodId,
			});
			if (!method || method.detachedAt) return;
			method.detachedAt = await databaseNow(manager);
			await this.suspendAutoTopUp(manager, { paymentMethodId: method.id });
		});
	}

	// For cards of a customer account Stripe no longer has.
	async markAllDetached(
		manager: EntityManager,
		organizationId: string
	): Promise<void> {
		await manager.nativeUpdate(
			PaymentMethod,
			{ organizationId, detachedAt: null },
			{ detachedAt: await databaseNow(manager) }
		);
		await this.suspendAutoTopUp(manager, { organizationId });
	}

	private async attached(stripePaymentMethodId: string): Promise<boolean> {
		try {
			const remote = await this.stripe.paymentMethods.retrieve(
				stripePaymentMethodId
			);
			return remote.customer_account !== null || remote.customer !== null;
		} catch (error) {
			if (isStripeObjectMissing(error)) return false;
			throw error;
		}
	}

	private async suspendAutoTopUp(
		manager: EntityManager,
		where:
			| Pick<AutoTopUpPolicy, 'paymentMethodId'>
			| Pick<AutoTopUpPolicy, 'organizationId'>
	): Promise<void> {
		await manager.nativeUpdate(
			AutoTopUpPolicy,
			{ ...where, enabled: true },
			{
				enabled: false,
				suspendedReason: AutoTopUpSuspendedReason.PAYMENT_METHOD_DETACHED,
			}
		);
	}

	private applyCard(
		method: PaymentMethod,
		card: StripeCard,
		fingerprint: string
	): void {
		method.cardFingerprint = fingerprint;
		method.brand = card.brand;
		method.last4 = card.last4;
		method.expMonth = card.exp_month;
		method.expYear = card.exp_year;
	}
}
