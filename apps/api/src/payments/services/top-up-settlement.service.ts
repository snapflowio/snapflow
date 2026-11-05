/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
	isStripeObjectMissing,
	stripeErrorDetails,
} from '../../common/utils/error/stripe-error.util';
import { addMilliseconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { TOP_UP_SETTLEMENT } from '../constants/payments.constants';
import {
	STRIPE_CLIENT,
	StripePaymentIntentStatus,
} from '../constants/stripe.constants';
import { TopUp } from '../entities/top-up.entity';
import { TopUpKind } from '../enums/top-up-kind.enum';
import { TopUpState } from '../enums/top-up-state.enum';
import { StripePaymentEventService } from './stripe-event/stripe-payment-event.service';

const CheckoutStatus = {
	COMPLETE: 'complete',
	EXPIRED: 'expired',
} as const satisfies Record<string, Stripe.Checkout.Session.Status>;
const CHECKOUT_SESSION_EXPANSIONS = ['payment_intent'];

@Injectable()
export class TopUpSettlementService {
	private readonly logger = new Logger(TopUpSettlementService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly payments: StripePaymentEventService
	) {}

	// Settles a created Checkout top-up from Stripe, so paid top-ups are
	// credited even when their webhooks never arrive.
	async settle(topUp: TopUp): Promise<TopUp> {
		if (topUp.state !== TopUpState.CREATED || !topUp.stripeCheckoutSessionId) {
			return topUp;
		}
		const session = await this.retrieveSession(
			topUp,
			topUp.stripeCheckoutSessionId,
			{ expand: CHECKOUT_SESSION_EXPANSIONS }
		);
		if (session?.status === CheckoutStatus.EXPIRED) {
			await this.payments.checkoutSessionExpired(session);
		} else if (session?.status === CheckoutStatus.COMPLETE) {
			await this.payments.checkoutSessionCompleted(session);
			const intent = session.payment_intent;
			if (
				intent &&
				typeof intent !== 'string' &&
				intent.status === StripePaymentIntentStatus.SUCCEEDED
			) {
				await this.payments.paymentIntentSucceeded(intent);
			}
		} else if (session) {
			return topUp;
		}
		return this.entityManager.fork().findOneOrFail(TopUp, { id: topUp.id });
	}

	// A Checkout session Stripe no longer has can never be paid, so its top-up
	// expires and null is returned.
	async retrieveSession(
		topUp: TopUp,
		sessionId: string,
		params?: Stripe.Checkout.SessionRetrieveParams
	): Promise<Stripe.Checkout.Session | null> {
		try {
			return await this.stripe.checkout.sessions.retrieve(sessionId, params);
		} catch (error) {
			if (!isStripeObjectMissing(error)) throw error;
			this.logger.warn(
				`Top-up ${topUp.id} expires because its Checkout session is missing: ${stripeErrorDetails(error)}`
			);
			await this.entityManager.fork().nativeUpdate(
				TopUp,
				{
					id: topUp.id,
					stripeCheckoutSessionId: sessionId,
					state: TopUpState.CREATED,
				},
				{ state: TopUpState.EXPIRED }
			);
			return null;
		}
	}

	async settleStale(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const createdBefore = addMilliseconds(
				await databaseNow(this.entityManager),
				-TOP_UP_SETTLEMENT.graceMilliseconds
			);
			let after: string | null = null;
			for (;;) {
				const stale: TopUp[] = await this.entityManager.find(
					TopUp,
					{
						kind: TopUpKind.MANUAL,
						state: TopUpState.CREATED,
						stripeCheckoutSessionId: { $ne: null },
						createdAt: { $lte: createdBefore },
						...(after ? { id: { $gt: after } } : {}),
					},
					{ orderBy: { id: 'ASC' }, limit: TOP_UP_SETTLEMENT.batchSize }
				);
				for (const topUp of stale) await this.settleSafely(topUp);
				if (stale.length < TOP_UP_SETTLEMENT.batchSize) return;
				after = stale[stale.length - 1].id;
			}
		});
	}

	private async settleSafely(topUp: TopUp): Promise<void> {
		try {
			await this.settle(topUp);
		} catch (error) {
			this.logger.error(
				`Settling top-up ${topUp.id} failed: ${stripeErrorDetails(error)}`
			);
		}
	}
}
