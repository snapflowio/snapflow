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
	hostTransfersPendingAccount,
	platformAccount,
	providerEarningsAccount,
} from '../../../billing/utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../../../billing/utils/ledger/ledger-posting-builder.util';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import { payoutsInTransit, stripeBalance } from './platform-accounts.util';
import { assertPositive } from './posting-guard.util';

export interface PayoutPostingInput {
	payoutId: string;
	organizationId: string;
	amountMicroUsd: MicroUsd;
	effectiveAt: Date;
}

export function payoutCommitPosting(
	input: PayoutPostingInput
): BillingLedgerPosting {
	assertPositive('Payout commit', input.amountMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.PAYOUT_COMMIT,
		descriptionCode: BillingLedgerDescriptionCode.PAYOUT_COMMITTED,
		sourceReference: input.payoutId,
		effectiveAt: input.effectiveAt,
		metadata: { organizationId: input.organizationId },
	})
		.debit(providerEarningsAccount(input.organizationId), input.amountMicroUsd)
		.credit(
			hostTransfersPendingAccount(input.organizationId),
			input.amountMicroUsd
		)
		.build();
}

export function payoutTransferPosting(
	input: PayoutPostingInput & { transferId: string }
): BillingLedgerPosting {
	assertPositive('Payout transfer', input.amountMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.PAYOUT_TRANSFER,
		descriptionCode: BillingLedgerDescriptionCode.PAYOUT_TRANSFERRED,
		sourceReference: input.transferId,
		effectiveAt: input.effectiveAt,
		metadata: {
			organizationId: input.organizationId,
			payoutId: input.payoutId,
		},
	})
		.debit(
			hostTransfersPendingAccount(input.organizationId),
			input.amountMicroUsd
		)
		.credit(stripeBalance(), input.amountMicroUsd)
		.build();
}

export function payoutReversalPosting(
	input: PayoutPostingInput & { transferId: string; reversalId: string }
): BillingLedgerPosting {
	assertPositive('Payout transfer reversal', input.amountMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.PAYOUT_TRANSFER_REVERSAL,
		descriptionCode: BillingLedgerDescriptionCode.PAYOUT_TRANSFER_REVERSED,
		sourceReference: input.reversalId,
		effectiveAt: input.effectiveAt,
		metadata: {
			organizationId: input.organizationId,
			payoutId: input.payoutId,
			transferId: input.transferId,
		},
	})
		.debit(stripeBalance(), input.amountMicroUsd)
		.credit(providerEarningsAccount(input.organizationId), input.amountMicroUsd)
		.build();
}

export function payoutFailurePosting(
	input: PayoutPostingInput
): BillingLedgerPosting {
	assertPositive('Payout failure', input.amountMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.PAYOUT_FAILURE,
		descriptionCode: BillingLedgerDescriptionCode.PAYOUT_FAILED,
		sourceReference: input.payoutId,
		effectiveAt: input.effectiveAt,
		metadata: { organizationId: input.organizationId },
	})
		.debit(
			hostTransfersPendingAccount(input.organizationId),
			input.amountMicroUsd
		)
		.credit(providerEarningsAccount(input.organizationId), input.amountMicroUsd)
		.build();
}

export interface PlatformPayoutPostingInput {
	stripePayoutId: string;
	amountMicroUsd: MicroUsd;
	effectiveAt: Date;
}

export function platformPayoutCreatedPosting(
	input: PlatformPayoutPostingInput
): BillingLedgerPosting {
	assertPositive('Platform payout', input.amountMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_PLATFORM_PAYOUT,
		descriptionCode: BillingLedgerDescriptionCode.PLATFORM_PAYOUT_CREATED,
		sourceReference: input.stripePayoutId,
		effectiveAt: input.effectiveAt,
		metadata: {},
	})
		.debit(payoutsInTransit(), input.amountMicroUsd)
		.credit(stripeBalance(), input.amountMicroUsd)
		.build();
}

export function platformPayoutPaidPosting(
	input: PlatformPayoutPostingInput
): BillingLedgerPosting {
	assertPositive('Platform payout paid', input.amountMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_PLATFORM_PAYOUT_PAID,
		descriptionCode: BillingLedgerDescriptionCode.PLATFORM_PAYOUT_PAID,
		sourceReference: input.stripePayoutId,
		effectiveAt: input.effectiveAt,
		metadata: {},
	})
		.debit(
			platformAccount(BillingLedgerAccountCode.PLATFORM_BANK_CASH),
			input.amountMicroUsd
		)
		.credit(payoutsInTransit(), input.amountMicroUsd)
		.build();
}

export function platformPayoutFailedPosting(
	input: PlatformPayoutPostingInput
): BillingLedgerPosting {
	assertPositive('Platform payout failure', input.amountMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_PLATFORM_PAYOUT_FAILED,
		descriptionCode: BillingLedgerDescriptionCode.PLATFORM_PAYOUT_FAILED,
		sourceReference: input.stripePayoutId,
		effectiveAt: input.effectiveAt,
		metadata: {},
	})
		.debit(stripeBalance(), input.amountMicroUsd)
		.credit(payoutsInTransit(), input.amountMicroUsd)
		.build();
}
