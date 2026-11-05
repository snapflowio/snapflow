/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RoundingMode } from '../../common/constants/money.constants';
import type { BasisPoints } from '../../common/values/basis-points.value';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import {
	AccountFundingState,
	BillingAdmissionBlocker,
} from '../constants/billing.constants';
import {
	type BillingBudgetPolicy,
	blockingBudgetLimits,
	budgetLimits,
} from './billing-budget.util';

export interface BillingAdmissionInput {
	creditBalanceMicroUsd: MicroUsd;
	hasBillingActivity: boolean;
	availableMicroUsd: MicroUsd;
	minimumReservationMicroUsd: MicroUsd;
	monthlyCommittedMicroUsd: MicroUsd;
	networkCommittedMicroUsd: MicroUsd;
	budget: BillingBudgetPolicy | null;
	warningThresholdBasisPoints: BasisPoints;
	runwayMinutes: bigint | undefined;
	minimumRunwayMinutes: bigint;
}

export function billingAdmissionBlockers(
	input: BillingAdmissionInput
): BillingAdmissionBlocker[] {
	return financialBlockers(input);
}

export function accountFundingState(
	input: BillingAdmissionInput
): AccountFundingState {
	if (financialBlockers(input).length > 0) {
		return AccountFundingState.RESTRICTED;
	}
	return budgetWarning(input) || runwayWarning(input)
		? AccountFundingState.WARNING
		: AccountFundingState.HEALTHY;
}

function financialBlockers(
	input: BillingAdmissionInput
): BillingAdmissionBlocker[] {
	const limits = blockingBudgetLimits(input.budget);
	const blockers: BillingAdmissionBlocker[] = [];
	if (
		exceedsLimit(
			input.monthlyCommittedMicroUsd.add(input.minimumReservationMicroUsd),
			limits.monthlyLimitMicroUsd
		)
	) {
		blockers.push(BillingAdmissionBlocker.MONTHLY_BUDGET_EXHAUSTED);
	}
	if (
		reachesLimit(input.networkCommittedMicroUsd, limits.networkLimitMicroUsd)
	) {
		blockers.push(BillingAdmissionBlocker.NETWORK_BUDGET_EXHAUSTED);
	}
	if (input.availableMicroUsd.lessThan(input.minimumReservationMicroUsd)) {
		blockers.push(
			input.creditBalanceMicroUsd.isZero() && !input.hasBillingActivity
				? BillingAdmissionBlocker.FUNDING_REQUIRED
				: BillingAdmissionBlocker.FUNDING_EXHAUSTED
		);
	}
	return blockers;
}

function budgetWarning(input: BillingAdmissionInput): boolean {
	const limits = budgetLimits(input.budget);
	return (
		reachesThreshold(
			input.monthlyCommittedMicroUsd,
			limits.monthlyLimitMicroUsd,
			input.warningThresholdBasisPoints
		) ||
		reachesThreshold(
			input.networkCommittedMicroUsd,
			limits.networkLimitMicroUsd,
			input.warningThresholdBasisPoints
		)
	);
}

function runwayWarning(input: BillingAdmissionInput): boolean {
	return (
		input.runwayMinutes !== undefined &&
		input.runwayMinutes < input.minimumRunwayMinutes
	);
}

function exceedsLimit(amount: MicroUsd, limit: MicroUsd | null): boolean {
	return limit !== null && amount.greaterThan(limit);
}

function reachesLimit(amount: MicroUsd, limit: MicroUsd | null): boolean {
	return limit !== null && amount.atLeast(limit);
}

function reachesThreshold(
	amount: MicroUsd,
	limit: MicroUsd | null,
	threshold: BasisPoints
): boolean {
	return (
		limit !== null &&
		amount.atLeast(threshold.applyTo(limit, RoundingMode.CEIL))
	);
}
