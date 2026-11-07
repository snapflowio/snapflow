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
import { BillingRestriction } from '../enums/billing-restriction.enum';
import {
	billingRestriction,
	evaluateBillingCapacity,
} from './billing-capacity.util';

const base = {
	creditBalanceMicroUsd: MicroUsd.of(900n),
	pendingWithdrawalMicroUsd: MicroUsd.ZERO,
	fundingWalletReady: true,
	unpostedChargesMicroUsd: MicroUsd.of(200n),
	reservedUsageMicroUsd: MicroUsd.of(300n),
	requestedMicroUsd: MicroUsd.of(100n),
	monthSpendMicroUsd: MicroUsd.of(400n),
	monthlyLimitMicroUsd: MicroUsd.of(1_000n),
	networkMonthSpendMicroUsd: MicroUsd.of(50n),
	networkRequestedMicroUsd: MicroUsd.of(20n),
	networkLimitMicroUsd: MicroUsd.of(100n),
};

describe('evaluateBillingCapacity', () => {
	it('blocks network admission only once spend reaches the network budget', () => {
		assert.equal(
			evaluateBillingCapacity({
				...base,
				networkMonthSpendMicroUsd: MicroUsd.of(99n),
				networkRequestedMicroUsd: MicroUsd.of(1_000n),
			}).networkBudgetAllowed,
			true
		);
		const exhausted = evaluateBillingCapacity({
			...base,
			networkMonthSpendMicroUsd: MicroUsd.of(100n),
		});
		assert.equal(exhausted.networkBudgetAllowed, false);
		assert.equal(exhausted.allowed, false);
	});

	it('keeps renewing running placements after the network budget is exhausted', () => {
		const renewal = evaluateBillingCapacity({
			...base,
			networkMonthSpendMicroUsd: MicroUsd.of(500n),
			renewal: true,
		});
		assert.equal(renewal.networkBudgetAllowed, true);
		assert.equal(renewal.allowed, true);
	});

	it('uses one conservative capacity equation for admission', () => {
		const decision = evaluateBillingCapacity(base);
		assert.deepEqual(decision.availableMicroUsd, MicroUsd.of(400n));
		assert.deepEqual(decision.committedMicroUsd, MicroUsd.of(500n));
		assert.equal(decision.allowed, true);
	});

	it('blocks a request that breaches any hard ceiling', () => {
		const decision = evaluateBillingCapacity({
			...base,
			hostExposureMicroUsd: MicroUsd.of(950n),
			hostExposureLimitMicroUsd: MicroUsd.of(1_000n),
		});
		assert.equal(decision.fundingAllowed, true);
		assert.equal(decision.hostExposureAllowed, false);
		assert.equal(decision.allowed, false);
	});

	it('keeps a pending escrow withdrawal out of available funds', () => {
		const decision = evaluateBillingCapacity({
			...base,
			pendingWithdrawalMicroUsd: MicroUsd.of(350n),
		});
		assert.deepEqual(decision.availableMicroUsd, MicroUsd.of(50n));
		assert.equal(decision.fundingAllowed, false);
	});

	it('admits nothing without a usable funding wallet', () => {
		const decision = evaluateBillingCapacity({
			...base,
			fundingWalletReady: false,
		});
		assert.deepEqual(decision.availableMicroUsd, MicroUsd.of(400n));
		assert.equal(decision.fundingAllowed, false);
		assert.equal(decision.allowed, false);
	});

	it('treats owed credit as no capacity instead of failing', () => {
		const decision = evaluateBillingCapacity({
			...base,
			creditBalanceMicroUsd: MicroUsd.of(-100n),
		});
		assert.deepEqual(decision.availableMicroUsd, MicroUsd.ZERO);
		assert.equal(decision.fundingAllowed, false);
	});

	it('never reports negative available funds', () => {
		const decision = evaluateBillingCapacity({
			...base,
			creditBalanceMicroUsd: MicroUsd.of(50n),
		});
		assert.deepEqual(decision.availableMicroUsd, MicroUsd.ZERO);
		assert.equal(decision.fundingAllowed, false);
	});
});

describe('billingRestriction', () => {
	it('names insufficient credit when an organization without credit asks for a self-use reservation', () => {
		assert.equal(
			billingRestriction(
				evaluateBillingCapacity({
					...base,
					creditBalanceMicroUsd: MicroUsd.ZERO,
					unpostedChargesMicroUsd: MicroUsd.ZERO,
					reservedUsageMicroUsd: MicroUsd.ZERO,
					requestedMicroUsd: MicroUsd.of(20n),
				})
			),
			BillingRestriction.INSUFFICIENT_CREDIT
		);
	});

	it('names the exhausted network budget', () => {
		assert.equal(
			billingRestriction(
				evaluateBillingCapacity({
					...base,
					networkMonthSpendMicroUsd: MicroUsd.of(100n),
				})
			),
			BillingRestriction.NETWORK_BUDGET_EXHAUSTED
		);
	});

	it('names the exhausted monthly budget', () => {
		assert.equal(
			billingRestriction(
				evaluateBillingCapacity({
					...base,
					monthSpendMicroUsd: MicroUsd.of(1_000n),
				})
			),
			BillingRestriction.MONTHLY_BUDGET_EXHAUSTED
		);
	});

	it('names nothing for an admissible organization', () => {
		assert.equal(billingRestriction(evaluateBillingCapacity(base)), null);
	});
});
