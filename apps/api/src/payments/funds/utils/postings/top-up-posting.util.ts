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
} from '../../../../billing/ledger/constants/billing.constants';
import type { BillingLedgerPosting } from '../../../../billing/ledger/services/billing-ledger.service';
import {
	customerCreditAccount,
	platformAccount,
} from '../../../../billing/ledger/utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../../../../billing/ledger/utils/ledger/ledger-posting-builder.util';
import type { MicroUsd } from '../../../../common/values/micro-usd.value';
import { stripeBalance } from './platform-accounts.util';
import { assertNonNegative, assertPositive } from './posting-guard.util';

export interface TopUpPostingInput {
	paymentIntentId: string;
	topUpId: string;
	organizationId: string;
	grossMicroUsd: MicroUsd;
	taxMicroUsd: MicroUsd;
	effectiveAt: Date;
}

export function topUpPosting(input: TopUpPostingInput): BillingLedgerPosting {
	const creditMicroUsd = input.grossMicroUsd.subtract(input.taxMicroUsd);
	assertPositive('Top-up', creditMicroUsd);
	assertNonNegative('Top-up tax', input.taxMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_TOP_UP,
		descriptionCode: BillingLedgerDescriptionCode.TOP_UP_SUCCEEDED,
		sourceReference: input.paymentIntentId,
		effectiveAt: input.effectiveAt,
		metadata: {
			topUpId: input.topUpId,
			organizationId: input.organizationId,
			taxMicroUsd: input.taxMicroUsd.toString(),
		},
	})
		.debit(stripeBalance(), input.grossMicroUsd)
		.credit(customerCreditAccount(input.organizationId), creditMicroUsd)
		.creditIfPositive(
			platformAccount(BillingLedgerAccountCode.SALES_TAX_PAYABLE),
			input.taxMicroUsd
		)
		.build();
}
