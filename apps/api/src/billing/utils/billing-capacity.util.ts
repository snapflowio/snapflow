/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../common/values/micro-usd.value';
import { BillingRestriction } from '../enums/billing-restriction.enum';

export interface BillingCapacityInput {
	// Negative once a customer withdrew escrow funds that usage had consumed
	// but no host had claimed yet; it then offers no capacity at all.
	creditBalanceMicroUsd: MicroUsd;
	// A requested escrow withdrawal can leave once its dispute window ends, so
	// it is no longer available to new work.
	pendingWithdrawalMicroUsd: MicroUsd;
	// Usage is only paid through the escrow, so without a linked, unblocked
	// funding wallet nothing is admissible whatever the credit.
	fundingWalletReady: boolean;
	unpostedChargesMicroUsd: MicroUsd;
	reservedUsageMicroUsd: MicroUsd;
	requestedMicroUsd: MicroUsd;
	monthSpendMicroUsd: MicroUsd;
	monthlyLimitMicroUsd: MicroUsd | null;
	networkMonthSpendMicroUsd: MicroUsd;
	networkRequestedMicroUsd: MicroUsd;
	networkLimitMicroUsd: MicroUsd | null;
	renewal?: boolean;
	machineExposureMicroUsd?: MicroUsd;
	machineExposureLimitMicroUsd?: MicroUsd;
	hostExposureMicroUsd?: MicroUsd;
	hostExposureLimitMicroUsd?: MicroUsd;
}

export interface BillingCapacityDecision {
	availableMicroUsd: MicroUsd;
	committedMicroUsd: MicroUsd;
	monthlyCommittedMicroUsd: MicroUsd;
	networkMonthlyCommittedMicroUsd: MicroUsd;
	fundingAllowed: boolean;
	monthlyBudgetAllowed: boolean;
	networkBudgetAllowed: boolean;
	machineExposureAllowed: boolean;
	hostExposureAllowed: boolean;
	allowed: boolean;
}

export function evaluateBillingCapacity(
	input: BillingCapacityInput
): BillingCapacityDecision {
	assertNonnegative(input);
	const committedMicroUsd = input.unpostedChargesMicroUsd.add(
		input.reservedUsageMicroUsd
	);
	const availableMicroUsd = input.creditBalanceMicroUsd
		.subtract(committedMicroUsd)
		.subtract(input.pendingWithdrawalMicroUsd)
		.nonnegative();
	const monthlyCommittedMicroUsd = input.monthSpendMicroUsd.add(
		input.requestedMicroUsd
	);
	const networkMonthlyCommittedMicroUsd = input.networkMonthSpendMicroUsd.add(
		input.networkRequestedMicroUsd
	);
	const fundingAllowed =
		input.fundingWalletReady &&
		availableMicroUsd.atLeast(input.requestedMicroUsd);
	const monthlyBudgetAllowed =
		input.monthlyLimitMicroUsd === null ||
		monthlyCommittedMicroUsd.atMost(input.monthlyLimitMicroUsd);
	const networkBudgetAllowed =
		input.renewal === true ||
		input.networkLimitMicroUsd === null ||
		input.networkMonthSpendMicroUsd.lessThan(input.networkLimitMicroUsd);
	const machineExposureAllowed = exposureAllowed(
		input.machineExposureMicroUsd,
		input.machineExposureLimitMicroUsd,
		input.requestedMicroUsd
	);
	const hostExposureAllowed = exposureAllowed(
		input.hostExposureMicroUsd,
		input.hostExposureLimitMicroUsd,
		input.requestedMicroUsd
	);
	return {
		availableMicroUsd,
		committedMicroUsd,
		monthlyCommittedMicroUsd,
		networkMonthlyCommittedMicroUsd,
		fundingAllowed,
		monthlyBudgetAllowed,
		networkBudgetAllowed,
		machineExposureAllowed,
		hostExposureAllowed,
		allowed:
			fundingAllowed &&
			monthlyBudgetAllowed &&
			networkBudgetAllowed &&
			machineExposureAllowed &&
			hostExposureAllowed,
	};
}

export function billingRestriction(
	decision: Pick<
		BillingCapacityDecision,
		'fundingAllowed' | 'monthlyBudgetAllowed' | 'networkBudgetAllowed'
	>
): BillingRestriction | null {
	if (!decision.fundingAllowed) return BillingRestriction.INSUFFICIENT_CREDIT;
	if (!decision.monthlyBudgetAllowed) {
		return BillingRestriction.MONTHLY_BUDGET_EXHAUSTED;
	}
	if (!decision.networkBudgetAllowed) {
		return BillingRestriction.NETWORK_BUDGET_EXHAUSTED;
	}
	return null;
}

function exposureAllowed(
	exposure: MicroUsd | undefined,
	limit: MicroUsd | undefined,
	requested: MicroUsd
): boolean {
	if (exposure === undefined && limit === undefined) return true;
	if (exposure === undefined || limit === undefined) {
		throw new Error('Billing exposure and its limit must be supplied together');
	}
	return exposure.add(requested).atMost(limit);
}

function assertNonnegative(input: BillingCapacityInput): void {
	const { creditBalanceMicroUsd: _owedCreditMayBeNegative, ...amounts } = input;
	for (const [name, value] of Object.entries(amounts)) {
		if (value instanceof MicroUsd && value.isNegative()) {
			throw new Error(`${name} must be nonnegative`);
		}
	}
}
