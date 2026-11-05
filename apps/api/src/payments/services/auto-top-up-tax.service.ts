/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import {
	CREDIT_PRODUCT_TAX_CODE,
	STRIPE_ACCOUNT_INCLUDE,
	STRIPE_CLIENT,
	STRIPE_CURRENCY,
	STRIPE_TAX_ADDRESS_SOURCE,
	STRIPE_TAX_BEHAVIOR,
	StripeIdempotencyPrefix,
} from '../constants/stripe.constants';
import type { PaymentAccount } from '../entities/payment-account.entity';
import type { TopUp } from '../entities/top-up.entity';
import { idempotencyKey } from '../utils/stripe-amount.util';

export interface TaxQuote {
	taxCents: number;
	calculationId: string | null;
}

export const NO_TAX: TaxQuote = { taxCents: 0, calculationId: null };

export class AutoTopUpTaxLocationError extends Error {
	constructor() {
		super('The customer has no tax location for an automatic top-up');
	}
}

@Injectable()
export class AutoTopUpTaxService {
	constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe) {}

	async quote(account: PaymentAccount, topUp: TopUp): Promise<TaxQuote> {
		const remote = await this.stripe.v2.core.accounts.retrieve(
			account.stripeAccountId,
			{ include: [...STRIPE_ACCOUNT_INCLUDE] }
		);
		const location =
			remote.configuration?.customer?.automatic_indirect_tax?.location;
		if (!location?.country) {
			throw new AutoTopUpTaxLocationError();
		}
		const calculation = await this.stripe.tax.calculations.create(
			{
				currency: STRIPE_CURRENCY,
				line_items: [
					{
						amount: topUp.amountCents,
						reference: topUp.id,
						tax_code: CREDIT_PRODUCT_TAX_CODE,
						tax_behavior: STRIPE_TAX_BEHAVIOR,
					},
				],
				customer_details: {
					address: { country: location.country, state: location.state },
					address_source: STRIPE_TAX_ADDRESS_SOURCE,
				},
			},
			{
				idempotencyKey: idempotencyKey(
					StripeIdempotencyPrefix.TAX_CALCULATION,
					topUp.id
				),
			}
		);
		if (!calculation.id) {
			throw new Error('Stripe returned a tax calculation without an id');
		}
		return {
			taxCents: calculation.tax_amount_exclusive,
			calculationId: calculation.id,
		};
	}
}
