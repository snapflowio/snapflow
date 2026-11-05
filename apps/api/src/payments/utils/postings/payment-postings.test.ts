/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	BillingLedgerAccountCode,
	BillingLedgerSide,
	BillingLedgerSourceType,
} from '../../../billing/constants/billing.constants';
import type { BillingLedgerPosting } from '../../../billing/services/billing-ledger.service';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	disputeFreezePosting,
	disputeLossPosting,
	disputeReinstatementPosting,
	disputeWithdrawalPosting,
} from './dispute-posting.util';
import { earningsMaturityPosting } from './earnings-posting.util';
import {
	payoutCommitPosting,
	payoutFailurePosting,
	payoutReversalPosting,
	payoutTransferPosting,
	platformPayoutCreatedPosting,
	platformPayoutFailedPosting,
	platformPayoutPaidPosting,
} from './payout-posting.util';
import { refundFailurePosting, refundPosting } from './refund-posting.util';
import {
	chargeFeePosting,
	stripePlatformFeePosting,
} from './stripe-fee-posting.util';
import { topUpPosting } from './top-up-posting.util';

const AT = new Date('2026-10-14T12:00:00.000Z');
const CUSTOMER = 'customer-organization';
const HOST = 'host-organization';

function totals(posting: BillingLedgerPosting): {
	debit: bigint;
	credit: bigint;
} {
	let debit = 0n;
	let credit = 0n;
	for (const entry of posting.entries) {
		const amount = BigInt(entry.amount);
		assert.ok(amount > 0n, `${posting.sourceType} has a non-positive entry`);
		if (entry.side === BillingLedgerSide.DEBIT) debit += amount;
		else credit += amount;
	}
	return { debit, credit };
}

function assertBalanced(posting: BillingLedgerPosting): void {
	const { debit, credit } = totals(posting);
	assert.equal(debit, credit, `${posting.sourceType} is not balanced`);
}

function amountOn(
	posting: BillingLedgerPosting,
	accountCode: string,
	side: string
): bigint {
	return posting.entries
		.filter(
			(entry) =>
				entry.account.accountCode === accountCode && entry.side === side
		)
		.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
}

describe('payment posting builders', () => {
	it('credits a top-up net of tax to the customer under the payment intent', () => {
		const posting = topUpPosting({
			paymentIntentId: 'pi_1',
			topUpId: 'top-up',
			organizationId: CUSTOMER,
			grossMicroUsd: MicroUsd.of(27_000_000n),
			taxMicroUsd: MicroUsd.of(2_000_000n),
			effectiveAt: AT,
		});
		assertBalanced(posting);
		assert.equal(posting.sourceType, BillingLedgerSourceType.STRIPE_TOP_UP);
		assert.equal(posting.sourceReference, 'pi_1');
		assert.equal(
			amountOn(
				posting,
				BillingLedgerAccountCode.STRIPE_BALANCE,
				BillingLedgerSide.DEBIT
			),
			27_000_000n
		);
		assert.equal(
			amountOn(
				posting,
				BillingLedgerAccountCode.CUSTOMER_CREDIT,
				BillingLedgerSide.CREDIT
			),
			25_000_000n
		);
		assert.equal(
			amountOn(
				posting,
				BillingLedgerAccountCode.SALES_TAX_PAYABLE,
				BillingLedgerSide.CREDIT
			),
			2_000_000n
		);
	});

	it('omits the tax entry when no tax was charged', () => {
		const posting = topUpPosting({
			paymentIntentId: 'pi_2',
			topUpId: 'top-up',
			organizationId: CUSTOMER,
			grossMicroUsd: MicroUsd.of(10_000_000n),
			taxMicroUsd: MicroUsd.ZERO,
			effectiveAt: AT,
		});
		assertBalanced(posting);
		assert.equal(posting.entries.length, 2);
	});

	it('books card and platform fees against the Stripe balance by balance transaction', () => {
		const card = chargeFeePosting({
			balanceTransactionId: 'txn_card',
			chargeId: 'ch_1',
			feeMicroUsd: MicroUsd.of(1_030_000n),
			effectiveAt: AT,
		});
		const platform = stripePlatformFeePosting({
			balanceTransactionId: 'txn_fee',
			balanceTransactionType: 'stripe_fee',
			feeMicroUsd: MicroUsd.of(2_000_000n),
			effectiveAt: AT,
		});
		for (const posting of [card, platform]) assertBalanced(posting);
		assert.equal(card.sourceType, BillingLedgerSourceType.STRIPE_CHARGE_FEE);
		assert.equal(card.sourceReference, 'txn_card');
		assert.equal(
			platform.sourceType,
			BillingLedgerSourceType.STRIPE_PLATFORM_FEE
		);
		assert.equal(platform.sourceReference, 'txn_fee');
	});

	it('runs a lost dispute through withdrawal, freeze and loss so disputed funds close at zero', () => {
		const withdrawal = disputeWithdrawalPosting({
			disputeId: 'du_1',
			balanceTransactionId: 'txn_w',
			organizationId: CUSTOMER,
			disputedMicroUsd: MicroUsd.of(25_000_000n),
			feeMicroUsd: MicroUsd.of(15_000_000n),
			effectiveAt: AT,
		});
		const freeze = disputeFreezePosting({
			disputeId: 'du_1',
			organizationId: CUSTOMER,
			frozenMicroUsd: MicroUsd.of(10_000_000n),
			effectiveAt: AT,
		});
		const loss = disputeLossPosting({
			disputeId: 'du_1',
			organizationId: CUSTOMER,
			lostMicroUsd: MicroUsd.of(15_000_000n),
			effectiveAt: AT,
		});
		for (const posting of [withdrawal, freeze, loss]) assertBalanced(posting);
		assert.equal(withdrawal.sourceReference, 'du_1:txn_w');
		assert.equal(freeze.sourceReference, 'du_1');
		assert.equal(loss.sourceReference, 'du_1');
		const disputed = [withdrawal, freeze, loss].reduce(
			(balance, posting) =>
				balance +
				amountOn(
					posting,
					BillingLedgerAccountCode.DISPUTED_FUNDS,
					BillingLedgerSide.DEBIT
				) -
				amountOn(
					posting,
					BillingLedgerAccountCode.DISPUTED_FUNDS,
					BillingLedgerSide.CREDIT
				),
			0n
		);
		assert.equal(disputed, 0n);
	});

	it('restores frozen credit and the refunded fee when a dispute is won', () => {
		const reinstatement = disputeReinstatementPosting({
			disputeId: 'du_2',
			balanceTransactionId: 'txn_r',
			organizationId: CUSTOMER,
			reinstatedMicroUsd: MicroUsd.of(25_000_000n),
			restoredMicroUsd: MicroUsd.of(10_000_000n),
			feeRefundMicroUsd: MicroUsd.of(15_000_000n),
			effectiveAt: AT,
		});
		assertBalanced(reinstatement);
		assert.equal(reinstatement.sourceReference, 'du_2:txn_r');
		assert.equal(
			amountOn(
				reinstatement,
				BillingLedgerAccountCode.CUSTOMER_CREDIT,
				BillingLedgerSide.CREDIT
			),
			10_000_000n
		);
		assert.equal(
			amountOn(
				reinstatement,
				BillingLedgerAccountCode.DISPUTED_FUNDS,
				BillingLedgerSide.CREDIT
			),
			15_000_000n
		);
	});

	it('matures host earnings by billing line', () => {
		const maturity = earningsMaturityPosting({
			lineId: 'line-1',
			hostOrganizationId: HOST,
			amountMicroUsd: MicroUsd.of(800_000n),
			effectiveAt: AT,
		});
		assertBalanced(maturity);
		assert.equal(
			maturity.sourceType,
			BillingLedgerSourceType.EARNINGS_MATURITY
		);
		assert.equal(maturity.sourceReference, 'line-1');
		assert.equal(
			amountOn(
				maturity,
				BillingLedgerAccountCode.HOST_EARNINGS_PAYABLE,
				BillingLedgerSide.CREDIT
			),
			800_000n
		);
	});

	it('returns a reversed payout transfer to the host earnings by reversal id', () => {
		const reversal = payoutReversalPosting({
			payoutId: 'payout-1',
			organizationId: HOST,
			transferId: 'tr_1',
			reversalId: 'trr_1',
			amountMicroUsd: MicroUsd.of(20_000_000n),
			effectiveAt: AT,
		});
		assertBalanced(reversal);
		assert.equal(
			reversal.sourceType,
			BillingLedgerSourceType.PAYOUT_TRANSFER_REVERSAL
		);
		assert.equal(reversal.sourceReference, 'trr_1');
		assert.equal(
			amountOn(
				reversal,
				BillingLedgerAccountCode.STRIPE_BALANCE,
				BillingLedgerSide.DEBIT
			),
			20_000_000n
		);
		assert.equal(
			amountOn(
				reversal,
				BillingLedgerAccountCode.HOST_EARNINGS_PAYABLE,
				BillingLedgerSide.CREDIT
			),
			20_000_000n
		);
	});

	it('debits a refund from credit, tax and losses and mirrors it on failure', () => {
		const input = {
			refundId: 're_1',
			paymentIntentId: 'pi_1',
			topUpId: 'top-up',
			organizationId: CUSTOMER,
			split: {
				creditMicroUsd: MicroUsd.of(6_000_000n),
				taxMicroUsd: MicroUsd.of(1_000_000n),
				lossMicroUsd: MicroUsd.of(3_000_000n),
			},
			effectiveAt: AT,
		};
		const refund = refundPosting(input);
		const failure = refundFailurePosting(input);
		for (const posting of [refund, failure]) {
			assertBalanced(posting);
			assert.equal(posting.sourceReference, 're_1');
		}
		assert.equal(refund.sourceType, BillingLedgerSourceType.STRIPE_REFUND);
		assert.equal(
			failure.sourceType,
			BillingLedgerSourceType.STRIPE_REFUND_FAILURE
		);
		assert.equal(
			amountOn(
				refund,
				BillingLedgerAccountCode.STRIPE_BALANCE,
				BillingLedgerSide.CREDIT
			),
			10_000_000n
		);
		assert.equal(
			amountOn(
				refund,
				BillingLedgerAccountCode.CUSTOMER_CREDIT,
				BillingLedgerSide.DEBIT
			),
			6_000_000n
		);
		assert.equal(
			amountOn(
				refund,
				BillingLedgerAccountCode.REFUND_LOSSES,
				BillingLedgerSide.DEBIT
			),
			3_000_000n
		);
		assert.equal(
			amountOn(
				failure,
				BillingLedgerAccountCode.CUSTOMER_CREDIT,
				BillingLedgerSide.CREDIT
			),
			6_000_000n
		);
		assert.equal(
			amountOn(
				failure,
				BillingLedgerAccountCode.SALES_TAX_PAYABLE,
				BillingLedgerSide.CREDIT
			),
			1_000_000n
		);
	});

	it('moves a payout through commit and transfer, or back on failure', () => {
		const input = {
			payoutId: 'payout-1',
			organizationId: HOST,
			amountMicroUsd: MicroUsd.of(50_000_000n),
			effectiveAt: AT,
		};
		const commit = payoutCommitPosting(input);
		const transfer = payoutTransferPosting({ ...input, transferId: 'tr_1' });
		const failure = payoutFailurePosting(input);
		for (const posting of [commit, transfer, failure]) assertBalanced(posting);
		assert.equal(commit.sourceReference, 'payout-1');
		assert.equal(transfer.sourceReference, 'tr_1');
		assert.equal(failure.sourceReference, 'payout-1');
		assert.equal(
			amountOn(
				failure,
				BillingLedgerAccountCode.HOST_EARNINGS_PAYABLE,
				BillingLedgerSide.CREDIT
			),
			50_000_000n
		);
	});

	it('tracks platform payouts in transit by payout id', () => {
		const input = {
			stripePayoutId: 'po_1',
			amountMicroUsd: MicroUsd.of(100_000_000n),
			effectiveAt: AT,
		};
		const postings = [
			platformPayoutCreatedPosting(input),
			platformPayoutPaidPosting(input),
			platformPayoutFailedPosting(input),
		];
		for (const posting of postings) {
			assertBalanced(posting);
			assert.equal(posting.sourceReference, 'po_1');
		}
		assert.deepEqual(
			postings.map((posting) => posting.sourceType),
			[
				BillingLedgerSourceType.STRIPE_PLATFORM_PAYOUT,
				BillingLedgerSourceType.STRIPE_PLATFORM_PAYOUT_PAID,
				BillingLedgerSourceType.STRIPE_PLATFORM_PAYOUT_FAILED,
			]
		);
	});

	it('refuses empty or negative postings', () => {
		assert.throws(() =>
			earningsMaturityPosting({
				lineId: 'line',
				hostOrganizationId: HOST,
				amountMicroUsd: MicroUsd.ZERO,
				effectiveAt: AT,
			})
		);
		assert.throws(() =>
			topUpPosting({
				paymentIntentId: 'pi',
				topUpId: 'top-up',
				organizationId: CUSTOMER,
				grossMicroUsd: MicroUsd.of(1_000_000n),
				taxMicroUsd: MicroUsd.of(2_000_000n),
				effectiveAt: AT,
			})
		);
	});
});
