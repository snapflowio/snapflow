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
import { BasisPoints } from '../../common/values/basis-points.value';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	AccountFundingState,
	BillingAdmissionBlocker,
	BillingBudgetMode,
} from '../constants/billing.constants';
import {
	accountFundingState,
	type BillingAdmissionInput,
	billingAdmissionBlockers,
} from './billing-admission.util';

const blockBudget = {
	mode: BillingBudgetMode.BLOCK_NEW,
	monthlyLimitMicroUsd: '100000000',
	networkLimitMicroUsd: '10000000',
};

const alertBudget = { ...blockBudget, mode: BillingBudgetMode.ALERT };

const readyInput: BillingAdmissionInput = {
	creditBalanceMicroUsd: MicroUsd.of(50_000_000n),
	hasBillingActivity: true,
	availableMicroUsd: MicroUsd.of(40_000_000n),
	minimumReservationMicroUsd: MicroUsd.of(1_000_001n),
	monthlyCommittedMicroUsd: MicroUsd.of(10_000_000n),
	networkCommittedMicroUsd: MicroUsd.of(2_000_000n),
	budget: blockBudget,
	warningThresholdBasisPoints: BasisPoints.of(8_000),
	runwayMinutes: 600n,
	minimumRunwayMinutes: 60n,
};

describe('billing admission blockers', () => {
	it('reports an unfunded account as requiring funding', () => {
		assert.deepEqual(
			billingAdmissionBlockers({
				...readyInput,
				creditBalanceMicroUsd: MicroUsd.ZERO,
				availableMicroUsd: MicroUsd.ZERO,
				monthlyCommittedMicroUsd: MicroUsd.ZERO,
				hasBillingActivity: false,
			}),
			[BillingAdmissionBlocker.FUNDING_REQUIRED]
		);
	});

	it('treats available funds below the minimum reservation as exhausted', () => {
		const input = { ...readyInput, availableMicroUsd: MicroUsd.of(1_000_000n) };
		assert.deepEqual(billingAdmissionBlockers(input), [
			BillingAdmissionBlocker.FUNDING_EXHAUSTED,
		]);
		assert.equal(accountFundingState(input), AccountFundingState.RESTRICTED);
		assert.deepEqual(
			billingAdmissionBlockers({
				...readyInput,
				availableMicroUsd: readyInput.minimumReservationMicroUsd,
			}),
			[]
		);
	});

	it('blocks on an exhausted monthly budget only in block mode', () => {
		const exhausted = {
			...readyInput,
			monthlyCommittedMicroUsd: MicroUsd.of(99_500_000n),
		};
		assert.deepEqual(billingAdmissionBlockers(exhausted), [
			BillingAdmissionBlocker.MONTHLY_BUDGET_EXHAUSTED,
		]);
		assert.equal(
			accountFundingState(exhausted),
			AccountFundingState.RESTRICTED
		);

		const alerted = { ...exhausted, budget: alertBudget };
		assert.deepEqual(billingAdmissionBlockers(alerted), []);
		assert.equal(accountFundingState(alerted), AccountFundingState.WARNING);
	});

	it('blocks new placements once network spend reaches the network budget in every mode', () => {
		const exhausted = {
			...readyInput,
			networkCommittedMicroUsd: MicroUsd.of(10_000_000n),
		};
		assert.deepEqual(billingAdmissionBlockers(exhausted), [
			BillingAdmissionBlocker.NETWORK_BUDGET_EXHAUSTED,
		]);
		assert.equal(
			accountFundingState(exhausted),
			AccountFundingState.RESTRICTED
		);
		assert.deepEqual(
			billingAdmissionBlockers({ ...exhausted, budget: alertBudget }),
			[BillingAdmissionBlocker.NETWORK_BUDGET_EXHAUSTED]
		);
		assert.deepEqual(
			billingAdmissionBlockers({
				...readyInput,
				networkCommittedMicroUsd: MicroUsd.of(9_999_999n),
			}),
			[]
		);
	});

	it('reports every financial blocker together', () => {
		assert.deepEqual(
			billingAdmissionBlockers({
				...readyInput,
				availableMicroUsd: MicroUsd.ZERO,
				monthlyCommittedMicroUsd: MicroUsd.of(100_000_000n),
				networkCommittedMicroUsd: MicroUsd.of(10_000_000n),
			}),
			[
				BillingAdmissionBlocker.MONTHLY_BUDGET_EXHAUSTED,
				BillingAdmissionBlocker.NETWORK_BUDGET_EXHAUSTED,
				BillingAdmissionBlocker.FUNDING_EXHAUSTED,
			]
		);
	});

	it('returns no blocker for an active and funded account', () => {
		assert.deepEqual(billingAdmissionBlockers(readyInput), []);
	});
});

describe('account funding state', () => {
	it('restricts a user without credit or activity', () => {
		assert.equal(
			accountFundingState({
				...readyInput,
				creditBalanceMicroUsd: MicroUsd.ZERO,
				availableMicroUsd: MicroUsd.ZERO,
				hasBillingActivity: false,
			}),
			AccountFundingState.RESTRICTED
		);
	});

	it('warns at the configured threshold and on a short runway', () => {
		assert.equal(accountFundingState(readyInput), AccountFundingState.HEALTHY);
		assert.equal(
			accountFundingState({
				...readyInput,
				monthlyCommittedMicroUsd: MicroUsd.of(80_000_000n),
			}),
			AccountFundingState.WARNING
		);
		assert.equal(
			accountFundingState({ ...readyInput, runwayMinutes: 59n }),
			AccountFundingState.WARNING
		);
	});

	it('stays healthy without a budget', () => {
		assert.equal(
			accountFundingState({
				...readyInput,
				budget: null,
				monthlyCommittedMicroUsd: MicroUsd.of(1_000_000_000n),
			}),
			AccountFundingState.HEALTHY
		);
	});
});
