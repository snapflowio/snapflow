/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	BillingLedgerAccountCode,
	BillingLedgerDescriptionCode,
	BillingLedgerSourceType,
} from '../../constants/billing.constants';
import type { BillingLedgerPosting } from '../../services/billing-ledger.service';
import {
	customerCreditAccount,
	hostPendingEarningsAccount,
	platformAccount,
} from './billing-ledger-accounts.util';
import {
	LedgerPostingBuilder,
	type LedgerPostingSource,
} from './ledger-posting-builder.util';

export type EscrowPostingSource = Pick<
	LedgerPostingSource,
	'sourceReference' | 'effectiveAt' | 'metadata'
>;

export interface EscrowTransfer extends EscrowPostingSource {
	organizationId: string;
	amountMicroUsd: MicroUsd;
}

// A claim that pays the host nothing, as a platform service channel's
// claims never do, needs no host organization. The paying customer touches
// none of the claim's accounts and is recorded in its metadata, so its
// statement can show what claims took from its escrow balance.
export interface EscrowClaim extends EscrowPostingSource {
	customerOrganizationId: string;
	hostOrganizationId: string | null;
	hostMicroUsd: MicroUsd;
	platformMicroUsd: MicroUsd;
}

const escrowCustody = platformAccount(BillingLedgerAccountCode.ESCROW_CUSTODY);

function requirePositive(amount: MicroUsd, sourceReference: string): void {
	if (!amount.isPositive()) {
		throw new Error(`Escrow event ${sourceReference} moves no funds`);
	}
}

// USDC the contract now holds on the customer's behalf becomes spendable
// credit.
export function escrowDepositPosting(
	deposit: EscrowTransfer
): BillingLedgerPosting {
	requirePositive(deposit.amountMicroUsd, deposit.sourceReference);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.ESCROW_DEPOSIT,
		descriptionCode: BillingLedgerDescriptionCode.ESCROW_DEPOSITED,
		sourceReference: deposit.sourceReference,
		effectiveAt: deposit.effectiveAt,
		metadata: deposit.metadata,
	})
		.debit(escrowCustody, deposit.amountMicroUsd)
		.credit(
			customerCreditAccount(deposit.organizationId),
			deposit.amountMicroUsd
		)
		.build();
}

// The reverse of a deposit. A customer can withdraw funds that usage already
// consumed but no host claimed yet, which leaves its credit negative: that is
// what it owes and no further work is admitted until it is covered again.
export function escrowWithdrawalPosting(
	withdrawal: EscrowTransfer
): BillingLedgerPosting {
	requirePositive(withdrawal.amountMicroUsd, withdrawal.sourceReference);
	return LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.ESCROW_WITHDRAWAL,
		descriptionCode: BillingLedgerDescriptionCode.ESCROW_WITHDRAWN,
		sourceReference: withdrawal.sourceReference,
		effectiveAt: withdrawal.effectiveAt,
		metadata: withdrawal.metadata,
	})
		.debit(
			customerCreditAccount(withdrawal.organizationId),
			withdrawal.amountMicroUsd
		)
		.credit(escrowCustody, withdrawal.amountMicroUsd)
		.build();
}

// A claim settles what usage already moved from the customer's credit to the
// host's pending earnings and the platform's revenue, so the customer's credit
// is untouched: the host's part leaves pending earnings and the platform's
// fee and service part lands in Snapflow's fee wallet.
export function escrowClaimPosting(claim: EscrowClaim): BillingLedgerPosting {
	const total = claim.hostMicroUsd.add(claim.platformMicroUsd);
	requirePositive(total, claim.sourceReference);
	const posting = LedgerPostingBuilder.for({
		sourceType: BillingLedgerSourceType.ESCROW_CLAIM,
		descriptionCode: BillingLedgerDescriptionCode.ESCROW_CLAIMED,
		sourceReference: claim.sourceReference,
		effectiveAt: claim.effectiveAt,
		metadata: {
			...claim.metadata,
			customerOrganizationId: claim.customerOrganizationId,
		},
	});
	if (claim.hostMicroUsd.isPositive()) {
		if (claim.hostOrganizationId === null) {
			throw new Error(
				`Escrow claim ${claim.sourceReference} pays a host without an organization`
			);
		}
		posting.debit(
			hostPendingEarningsAccount(claim.hostOrganizationId),
			claim.hostMicroUsd
		);
	}
	return posting
		.debitIfPositive(
			platformAccount(BillingLedgerAccountCode.PLATFORM_WALLET),
			claim.platformMicroUsd
		)
		.credit(escrowCustody, total)
		.build();
}
