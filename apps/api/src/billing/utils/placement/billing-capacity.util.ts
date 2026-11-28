/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../../common/values/micro-usd.value';
import { BillingRestriction } from '../../enums/billing-restriction.enum';

export interface BillingCapacityInput {
	spendableMicroUsd: MicroUsd;
	fundingWalletReady: boolean;
	requiredMicroUsd: MicroUsd;
	startingHourlyMicroUsd: MicroUsd | null;
	monthSpendMicroUsd: MicroUsd;
	monthlyLimitMicroUsd: MicroUsd | null;
	exposureRequestedMicroUsd: MicroUsd;
	machineExposureMicroUsd?: MicroUsd;
	machineExposureLimitMicroUsd?: MicroUsd;
	hostExposureMicroUsd?: MicroUsd;
	hostExposureLimitMicroUsd?: MicroUsd;
}

export interface BillingCapacityDecision {
	availableMicroUsd: MicroUsd;
	fundingAllowed: boolean;
	monthlyBudgetAllowed: boolean;
	machineExposureAllowed: boolean;
	hostExposureAllowed: boolean;
	allowed: boolean;
}

export function startFunded(
	input: Pick<
		BillingCapacityInput,
		| 'spendableMicroUsd'
		| 'fundingWalletReady'
		| 'requiredMicroUsd'
		| 'startingHourlyMicroUsd'
	>
): boolean {
	if (input.startingHourlyMicroUsd?.isZero()) return true;
	return (
		input.fundingWalletReady &&
		input.spendableMicroUsd.atLeast(input.requiredMicroUsd)
	);
}

export function evaluateBillingCapacity(
	input: BillingCapacityInput
): BillingCapacityDecision {
	const fundingAllowed = startFunded(input);
	const monthlyBudgetAllowed =
		input.monthlyLimitMicroUsd === null ||
		input.monthSpendMicroUsd.lessThan(input.monthlyLimitMicroUsd);
	const machineExposureAllowed = exposureAllowed(
		input.machineExposureMicroUsd,
		input.machineExposureLimitMicroUsd,
		input.exposureRequestedMicroUsd
	);
	const hostExposureAllowed = exposureAllowed(
		input.hostExposureMicroUsd,
		input.hostExposureLimitMicroUsd,
		input.exposureRequestedMicroUsd
	);
	return {
		availableMicroUsd: input.spendableMicroUsd,
		fundingAllowed,
		monthlyBudgetAllowed,
		machineExposureAllowed,
		hostExposureAllowed,
		allowed:
			fundingAllowed &&
			monthlyBudgetAllowed &&
			machineExposureAllowed &&
			hostExposureAllowed,
	};
}

export function billingRestriction(
	decision: Pick<
		BillingCapacityDecision,
		'fundingAllowed' | 'monthlyBudgetAllowed'
	>
): BillingRestriction | null {
	if (!decision.fundingAllowed) return BillingRestriction.INSUFFICIENT_CREDIT;
	if (!decision.monthlyBudgetAllowed) {
		return BillingRestriction.MONTHLY_BUDGET_EXHAUSTED;
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
