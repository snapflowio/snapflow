/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type Stripe from 'stripe';
import { BillingLedgerSourceType } from '../../billing/constants/billing.constants';
import { StripeBalanceTransactionType } from '../constants/stripe.constants';
import { disputeTransactionReference } from './postings/dispute-posting.util';
import { expandableId } from './stripe-amount.util';

export type ReconciledBalanceTransaction = Pick<
	Stripe.BalanceTransaction,
	'id' | 'type' | 'amount' | 'fee' | 'currency' | 'created' | 'source'
>;

export interface ExpectedLedgerSource {
	sourceTypes: readonly string[];
	sourceReference: string;
}

export const ReconciliationKind = {
	EXPECTED: 'expected',
	PLATFORM_FEE: 'platform_fee',
	UNMAPPED: 'unmapped',
} as const;

export type BalanceTransactionReconciliation =
	| {
			kind: typeof ReconciliationKind.EXPECTED;
			sources: readonly ExpectedLedgerSource[];
	  }
	| { kind: typeof ReconciliationKind.PLATFORM_FEE }
	| { kind: typeof ReconciliationKind.UNMAPPED };

const PLATFORM_FEE_TYPES: readonly string[] = [
	StripeBalanceTransactionType.STRIPE_FEE,
	StripeBalanceTransactionType.TAX_FEE,
];

interface SourcedTransaction {
	transaction: ReconciledBalanceTransaction;
	source: string;
}

type ExpectedSources = (
	sourced: SourcedTransaction
) => readonly ExpectedLedgerSource[];

function chargeFeeSources({
	transaction,
}: SourcedTransaction): readonly ExpectedLedgerSource[] {
	return transaction.fee > 0
		? [
				{
					sourceTypes: [BillingLedgerSourceType.STRIPE_CHARGE_FEE],
					sourceReference: transaction.id,
				},
			]
		: [];
}

function postedFromSource(...sourceTypes: string[]): ExpectedSources {
	return ({ source }) => [{ sourceTypes, sourceReference: source }];
}

function disputeAdjustmentSources({
	transaction,
	source,
}: SourcedTransaction): readonly ExpectedLedgerSource[] {
	return [
		{
			sourceTypes: [
				BillingLedgerSourceType.STRIPE_DISPUTE_WITHDRAWAL,
				BillingLedgerSourceType.STRIPE_DISPUTE_REINSTATEMENT,
			],
			sourceReference: disputeTransactionReference(source, transaction.id),
		},
	];
}

const EXPECTED_SOURCES: ReadonlyMap<string, ExpectedSources> = new Map([
	[StripeBalanceTransactionType.CHARGE, chargeFeeSources],
	[StripeBalanceTransactionType.PAYMENT, chargeFeeSources],
	[
		StripeBalanceTransactionType.REFUND,
		postedFromSource(BillingLedgerSourceType.STRIPE_REFUND),
	],
	[
		StripeBalanceTransactionType.REFUND_FAILURE,
		postedFromSource(BillingLedgerSourceType.STRIPE_REFUND_FAILURE),
	],
	[
		StripeBalanceTransactionType.TRANSFER,
		postedFromSource(BillingLedgerSourceType.PAYOUT_TRANSFER),
	],
	[
		StripeBalanceTransactionType.TRANSFER_REFUND,
		postedFromSource(BillingLedgerSourceType.PAYOUT_TRANSFER_REVERSAL),
	],
	[
		StripeBalanceTransactionType.PAYOUT,
		postedFromSource(BillingLedgerSourceType.STRIPE_PLATFORM_PAYOUT),
	],
	[
		StripeBalanceTransactionType.PAYOUT_FAILURE,
		postedFromSource(BillingLedgerSourceType.STRIPE_PLATFORM_PAYOUT_FAILED),
	],
	[StripeBalanceTransactionType.ADJUSTMENT, disputeAdjustmentSources],
]);

export function reconcileBalanceTransaction(
	transaction: ReconciledBalanceTransaction
): BalanceTransactionReconciliation {
	if (PLATFORM_FEE_TYPES.includes(transaction.type)) {
		return transaction.amount < 0
			? { kind: ReconciliationKind.PLATFORM_FEE }
			: { kind: ReconciliationKind.UNMAPPED };
	}
	const source = expandableId(transaction.source);
	const expectedSources = EXPECTED_SOURCES.get(transaction.type);
	if (!source || !expectedSources) return { kind: ReconciliationKind.UNMAPPED };
	return {
		kind: ReconciliationKind.EXPECTED,
		sources: expectedSources({ transaction, source }),
	};
}
