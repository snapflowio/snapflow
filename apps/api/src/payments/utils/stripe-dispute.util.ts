/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type Stripe from 'stripe';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { DisputeState } from '../enums/dispute-state.enum';
import { stripeAmountMicroUsd, stripeTimestamp } from './stripe-amount.util';

export type DisputeBalanceTransaction = Pick<
	Stripe.BalanceTransaction,
	'id' | 'amount' | 'fee' | 'currency' | 'created'
>;

export interface DisputeWithdrawal {
	balanceTransactionId: string;
	disputedMicroUsd: MicroUsd;
	feeMicroUsd: MicroUsd;
	effectiveAt: Date;
}

export interface DisputeReinstatement {
	balanceTransactionId: string;
	reinstatedMicroUsd: MicroUsd;
	restoredMicroUsd: MicroUsd;
	feeRefundMicroUsd: MicroUsd;
	effectiveAt: Date;
}

const DISPUTE_STATE: Readonly<Record<string, DisputeState>> = {
	needs_response: DisputeState.NEEDS_RESPONSE,
	warning_needs_response: DisputeState.NEEDS_RESPONSE,
	under_review: DisputeState.UNDER_REVIEW,
	warning_under_review: DisputeState.UNDER_REVIEW,
	won: DisputeState.WON,
	prevented: DisputeState.WON,
	warning_closed: DisputeState.WON,
	lost: DisputeState.LOST,
};

export function disputeState(status: Stripe.Dispute.Status): DisputeState {
	return DISPUTE_STATE[status] ?? DisputeState.NEEDS_RESPONSE;
}

export function disputeClosed(state: DisputeState): boolean {
	return state === DisputeState.WON || state === DisputeState.LOST;
}

function chronological(
	transactions: readonly DisputeBalanceTransaction[]
): DisputeBalanceTransaction[] {
	return [...transactions].sort(
		(left, right) =>
			left.created - right.created || left.id.localeCompare(right.id)
	);
}

export function disputeWithdrawals(
	transactions: readonly DisputeBalanceTransaction[]
): DisputeWithdrawal[] {
	return chronological(transactions)
		.filter((transaction) => transaction.amount < 0)
		.map((transaction) => ({
			balanceTransactionId: transaction.id,
			disputedMicroUsd: stripeAmountMicroUsd(
				transaction.amount,
				transaction.currency
			).negate(),
			feeMicroUsd: stripeAmountMicroUsd(
				Math.max(transaction.fee, 0),
				transaction.currency
			),
			effectiveAt: stripeTimestamp(transaction.created),
		}));
}

export function disputeReinstatements(
	transactions: readonly DisputeBalanceTransaction[],
	frozenMicroUsd: MicroUsd
): DisputeReinstatement[] {
	let unrestored = frozenMicroUsd;
	return chronological(transactions)
		.filter((transaction) => transaction.amount > 0)
		.map((transaction) => {
			const reinstatedMicroUsd = stripeAmountMicroUsd(
				transaction.amount,
				transaction.currency
			);
			const restoredMicroUsd = unrestored.min(reinstatedMicroUsd);
			unrestored = unrestored.subtract(restoredMicroUsd);
			return {
				balanceTransactionId: transaction.id,
				reinstatedMicroUsd,
				restoredMicroUsd,
				feeRefundMicroUsd: stripeAmountMicroUsd(
					Math.max(-transaction.fee, 0),
					transaction.currency
				),
				effectiveAt: stripeTimestamp(transaction.created),
			};
		});
}

// Credit is frozen only while funds are withdrawn and the dispute is still
// open or lost; a reinstatement or a win means the money came back.
export function shouldFreezeDisputedCredit(
	transactions: readonly DisputeBalanceTransaction[],
	state: DisputeState
): boolean {
	return (
		state !== DisputeState.WON &&
		transactions.some((transaction) => transaction.amount < 0) &&
		!transactions.some((transaction) => transaction.amount > 0)
	);
}

export function disputedTotal(
	transactions: readonly DisputeBalanceTransaction[]
): MicroUsd {
	return MicroUsd.sum(
		disputeWithdrawals(transactions).map(
			(withdrawal) => withdrawal.disputedMicroUsd
		)
	);
}

export function disputeLossMicroUsd(
	transactions: readonly DisputeBalanceTransaction[],
	frozenMicroUsd: MicroUsd
): MicroUsd {
	return disputedTotal(transactions).subtract(frozenMicroUsd).nonnegative();
}

export function disputeFreezeMicroUsd(
	disputedMicroUsd: MicroUsd,
	spendableMicroUsd: MicroUsd
): MicroUsd {
	return spendableMicroUsd.min(disputedMicroUsd).nonnegative();
}
