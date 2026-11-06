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
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	BillingLedgerAccountCode,
	BillingLedgerSourceType,
} from '../constants/billing.constants';
import { customerStatement, hostStatement } from './billing-statement.util';

const credit = BillingLedgerAccountCode.CUSTOMER_CREDIT;

describe('customerStatement', () => {
	it('shows private pool fees apart from usage and in the closing credit', () => {
		const statement = customerStatement({
			openingCreditMicroUsd: MicroUsd.of(20_000_000n),
			claimsPaidMicroUsd: MicroUsd.ZERO,
			usageBySandbox: [],
			totals: [
				{
					accountCode: credit,
					sourceType: BillingLedgerSourceType.LINE_USAGE,
					amountMicroUsd: MicroUsd.of(-3_000_000n),
				},
				{
					accountCode: credit,
					sourceType: BillingLedgerSourceType.PRIVATE_POOL_FEE,
					amountMicroUsd: MicroUsd.of(-5_000_000n),
				},
			],
		});
		assert.equal(statement.usageMicroUsd, '3000000');
		assert.equal(statement.privatePoolMicroUsd, '5000000');
		assert.equal(statement.closingCreditMicroUsd, '12000000');
	});

	it('shows escrow deposits and withdrawals in the credit and claims beside it', () => {
		const statement = customerStatement({
			openingCreditMicroUsd: MicroUsd.ZERO,
			claimsPaidMicroUsd: MicroUsd.of(4_000_000n),
			usageBySandbox: [],
			totals: [
				{
					accountCode: credit,
					sourceType: BillingLedgerSourceType.ESCROW_DEPOSIT,
					amountMicroUsd: MicroUsd.of(50_000_000n),
				},
				{
					accountCode: credit,
					sourceType: BillingLedgerSourceType.ESCROW_WITHDRAWAL,
					amountMicroUsd: MicroUsd.of(-10_000_000n),
				},
				{
					accountCode: credit,
					sourceType: BillingLedgerSourceType.LINE_USAGE,
					amountMicroUsd: MicroUsd.of(-4_000_000n),
				},
			],
		});
		assert.equal(statement.depositsMicroUsd, '50000000');
		assert.equal(statement.withdrawalsMicroUsd, '10000000');
		assert.equal(statement.claimsPaidMicroUsd, '4000000');
		assert.equal(statement.closingCreditMicroUsd, '36000000');
	});
});

describe('hostStatement', () => {
	it('shows what claims paid out of the earnings', () => {
		const pending = BillingLedgerAccountCode.HOST_EARNINGS_PENDING;
		const statement = hostStatement([
			{
				accountCode: pending,
				sourceType: BillingLedgerSourceType.LINE_USAGE,
				amountMicroUsd: MicroUsd.of(9_000_000n),
			},
			{
				accountCode: pending,
				sourceType: BillingLedgerSourceType.ESCROW_CLAIM,
				amountMicroUsd: MicroUsd.of(-6_000_000n),
			},
		]);
		assert.equal(statement.earningsMicroUsd, '9000000');
		assert.equal(statement.claimedMicroUsd, '6000000');
	});
});
