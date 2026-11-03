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
import { BillingLedgerSourceType } from '../../../billing/ledger/constants/billing.constants';
import {
	STRIPE_CURRENCY,
	StripeBalanceTransactionType,
} from '../constants/stripe.constants';
import {
	ReconciliationKind,
	reconcileBalanceTransaction,
} from './stripe-reconciliation.util';

const CREATED = 1_791_976_000;

function transaction(type: string, source: string, amount: number) {
	return {
		id: `txn_${source}`,
		type,
		amount,
		fee: 0,
		currency: STRIPE_CURRENCY,
		created: CREATED,
		source,
	};
}

describe('Stripe balance transaction reconciliation', () => {
	it('expects refunds, refund failures and transfer reversals by their source id', () => {
		assert.deepEqual(
			[
				transaction(StripeBalanceTransactionType.REFUND, 're_1', -1_000),
				transaction(StripeBalanceTransactionType.REFUND_FAILURE, 're_1', 1_000),
				transaction(
					StripeBalanceTransactionType.TRANSFER_REFUND,
					'trr_1',
					2_000
				),
			].map(reconcileBalanceTransaction),
			[
				{
					kind: ReconciliationKind.EXPECTED,
					sources: [
						{
							sourceTypes: [BillingLedgerSourceType.STRIPE_REFUND],
							sourceReference: 're_1',
						},
					],
				},
				{
					kind: ReconciliationKind.EXPECTED,
					sources: [
						{
							sourceTypes: [BillingLedgerSourceType.STRIPE_REFUND_FAILURE],
							sourceReference: 're_1',
						},
					],
				},
				{
					kind: ReconciliationKind.EXPECTED,
					sources: [
						{
							sourceTypes: [BillingLedgerSourceType.PAYOUT_TRANSFER_REVERSAL],
							sourceReference: 'trr_1',
						},
					],
				},
			]
		);
	});
});
