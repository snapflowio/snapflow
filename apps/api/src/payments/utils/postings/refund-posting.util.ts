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
import {
	customerCreditAccount,
	platformAccount,
} from '../../../billing/utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../../../billing/utils/ledger/ledger-posting-builder.util';
import {
	type RefundSplit,
	refundedMicroUsd,
	refundSplitMetadata,
} from '../stripe-refund.util';
import { stripeBalance } from './platform-accounts.util';
import { assertPositive } from './posting-guard.util';

export interface RefundPostingInput {
	refundId: string;
	paymentIntentId: string;
	topUpId: string;
	organizationId: string;
	split: RefundSplit;
	effectiveAt: Date;
}

function refundMetadata(input: RefundPostingInput): Record<string, string> {
	return {
		organizationId: input.organizationId,
		topUpId: input.topUpId,
		paymentIntentId: input.paymentIntentId,
		...refundSplitMetadata(input.split),
	};
}

function assertSplit(name: string, split: RefundSplit): void {
	assertPositive(
		name,
		split.creditMicroUsd,
		split.taxMicroUsd,
		split.lossMicroUsd
	);
}

export function refundPosting(input: RefundPostingInput): BillingLedgerPosting {
	assertSplit('Refund', input.split);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_REFUND,
		descriptionCode: BillingLedgerDescriptionCode.TOP_UP_REFUNDED,
		sourceReference: input.refundId,
		effectiveAt: input.effectiveAt,
		metadata: refundMetadata(input),
	})
		.debitIfPositive(
			customerCreditAccount(input.organizationId),
			input.split.creditMicroUsd
		)
		.debitIfPositive(
			platformAccount(BillingLedgerAccountCode.SALES_TAX_PAYABLE),
			input.split.taxMicroUsd
		)
		.debitIfPositive(
			platformAccount(BillingLedgerAccountCode.REFUND_LOSSES),
			input.split.lossMicroUsd
		)
		.credit(stripeBalance(), refundedMicroUsd(input.split))
		.build();
}

export function refundFailurePosting(
	input: RefundPostingInput
): BillingLedgerPosting {
	assertSplit('Refund failure', input.split);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_REFUND_FAILURE,
		descriptionCode: BillingLedgerDescriptionCode.TOP_UP_REFUND_FAILED,
		sourceReference: input.refundId,
		effectiveAt: input.effectiveAt,
		metadata: refundMetadata(input),
	})
		.debit(stripeBalance(), refundedMicroUsd(input.split))
		.creditIfPositive(
			customerCreditAccount(input.organizationId),
			input.split.creditMicroUsd
		)
		.creditIfPositive(
			platformAccount(BillingLedgerAccountCode.SALES_TAX_PAYABLE),
			input.split.taxMicroUsd
		)
		.creditIfPositive(
			platformAccount(BillingLedgerAccountCode.REFUND_LOSSES),
			input.split.lossMicroUsd
		)
		.build();
}
