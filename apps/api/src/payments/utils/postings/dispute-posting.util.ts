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
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	disputedFunds,
	disputeFees,
	stripeBalance,
} from './platform-accounts.util';
import { assertNonNegative, assertPositive } from './posting-guard.util';

const DISPUTE_REFERENCE_SEPARATOR = ':';

export function disputeTransactionReference(
	disputeId: string,
	balanceTransactionId: string
): string {
	return `${disputeId}${DISPUTE_REFERENCE_SEPARATOR}${balanceTransactionId}`;
}

export interface DisputeWithdrawalPostingInput {
	disputeId: string;
	balanceTransactionId: string;
	organizationId: string;
	disputedMicroUsd: MicroUsd;
	feeMicroUsd: MicroUsd;
	effectiveAt: Date;
}

export function disputeWithdrawalPosting(
	input: DisputeWithdrawalPostingInput
): BillingLedgerPosting {
	assertPositive('Dispute withdrawal', input.disputedMicroUsd);
	assertNonNegative('Dispute fee', input.feeMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_DISPUTE_WITHDRAWAL,
		descriptionCode: BillingLedgerDescriptionCode.DISPUTE_FUNDS_WITHDRAWN,
		sourceReference: disputeTransactionReference(
			input.disputeId,
			input.balanceTransactionId
		),
		effectiveAt: input.effectiveAt,
		metadata: { organizationId: input.organizationId },
	})
		.debit(disputedFunds(), input.disputedMicroUsd)
		.debitIfPositive(disputeFees(), input.feeMicroUsd)
		.credit(stripeBalance(), input.disputedMicroUsd.add(input.feeMicroUsd))
		.build();
}

export interface DisputeFreezePostingInput {
	disputeId: string;
	organizationId: string;
	frozenMicroUsd: MicroUsd;
	effectiveAt: Date;
}

export function disputeFreezePosting(
	input: DisputeFreezePostingInput
): BillingLedgerPosting {
	assertPositive('Dispute freeze', input.frozenMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_DISPUTE_FREEZE,
		descriptionCode: BillingLedgerDescriptionCode.DISPUTE_CREDIT_FROZEN,
		sourceReference: input.disputeId,
		effectiveAt: input.effectiveAt,
		metadata: { organizationId: input.organizationId },
	})
		.debit(customerCreditAccount(input.organizationId), input.frozenMicroUsd)
		.credit(disputedFunds(), input.frozenMicroUsd)
		.build();
}

export interface DisputeReinstatementPostingInput {
	disputeId: string;
	balanceTransactionId: string;
	organizationId: string;
	reinstatedMicroUsd: MicroUsd;
	restoredMicroUsd: MicroUsd;
	feeRefundMicroUsd: MicroUsd;
	effectiveAt: Date;
}

export function disputeReinstatementPosting(
	input: DisputeReinstatementPostingInput
): BillingLedgerPosting {
	const releasedMicroUsd = input.reinstatedMicroUsd.subtract(
		input.restoredMicroUsd
	);
	assertPositive('Dispute reinstatement', input.reinstatedMicroUsd);
	assertNonNegative(
		'Dispute reinstatement split',
		releasedMicroUsd,
		input.restoredMicroUsd,
		input.feeRefundMicroUsd
	);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_DISPUTE_REINSTATEMENT,
		descriptionCode: BillingLedgerDescriptionCode.DISPUTE_FUNDS_REINSTATED,
		sourceReference: disputeTransactionReference(
			input.disputeId,
			input.balanceTransactionId
		),
		effectiveAt: input.effectiveAt,
		metadata: { organizationId: input.organizationId },
	})
		.debit(
			stripeBalance(),
			input.reinstatedMicroUsd.add(input.feeRefundMicroUsd)
		)
		.creditIfPositive(disputedFunds(), releasedMicroUsd)
		.creditIfPositive(
			customerCreditAccount(input.organizationId),
			input.restoredMicroUsd
		)
		.creditIfPositive(disputeFees(), input.feeRefundMicroUsd)
		.build();
}

export interface DisputeLossPostingInput {
	disputeId: string;
	organizationId: string;
	lostMicroUsd: MicroUsd;
	effectiveAt: Date;
}

export function disputeLossPosting(
	input: DisputeLossPostingInput
): BillingLedgerPosting {
	assertPositive('Dispute loss', input.lostMicroUsd);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.STRIPE_DISPUTE_LOSS,
		descriptionCode: BillingLedgerDescriptionCode.DISPUTE_LOST,
		sourceReference: input.disputeId,
		effectiveAt: input.effectiveAt,
		metadata: { organizationId: input.organizationId },
	})
		.debit(
			platformAccount(BillingLedgerAccountCode.DISPUTE_LOSSES),
			input.lostMicroUsd
		)
		.credit(disputedFunds(), input.lostMicroUsd)
		.build();
}
