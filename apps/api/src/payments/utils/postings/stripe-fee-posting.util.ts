/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BillingLedgerAccountCode,
	BillingLedgerDescriptionCode,
	BillingLedgerSourceType,
} from '../../../billing/constants/billing.constants';
import type { BillingLedgerPosting } from '../../../billing/services/billing-ledger.service';
import { platformAccount } from '../../../billing/utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../../../billing/utils/ledger/ledger-posting-builder.util';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import { stripeBalance } from './platform-accounts.util';
import { assertPositive } from './posting-guard.util';

export interface StripeFeePostingInput {
	balanceTransactionId: string;
	feeMicroUsd: MicroUsd;
	effectiveAt: Date;
}

export function chargeFeePosting(
	input: StripeFeePostingInput & { chargeId: string }
): BillingLedgerPosting {
	assertPositive('Card fee', input.feeMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_CHARGE_FEE,
		descriptionCode: BillingLedgerDescriptionCode.CARD_FEE_CHARGED,
		sourceReference: input.balanceTransactionId,
		effectiveAt: input.effectiveAt,
		metadata: { chargeId: input.chargeId },
	})
		.debit(
			platformAccount(BillingLedgerAccountCode.PAYMENT_PROCESSING_FEES),
			input.feeMicroUsd
		)
		.credit(stripeBalance(), input.feeMicroUsd)
		.build();
}

export function stripePlatformFeePosting(
	input: StripeFeePostingInput & { balanceTransactionType: string }
): BillingLedgerPosting {
	assertPositive('Stripe fee', input.feeMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_PLATFORM_FEE,
		descriptionCode: BillingLedgerDescriptionCode.STRIPE_FEE_CHARGED,
		sourceReference: input.balanceTransactionId,
		effectiveAt: input.effectiveAt,
		metadata: { balanceTransactionType: input.balanceTransactionType },
	})
		.debit(
			platformAccount(BillingLedgerAccountCode.STRIPE_PLATFORM_FEES),
			input.feeMicroUsd
		)
		.credit(stripeBalance(), input.feeMicroUsd)
		.build();
}
