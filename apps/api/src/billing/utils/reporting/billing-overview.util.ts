/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_HOUR } from '../../../common/constants/time.constants';
import { millisecondsBetween } from '../../../common/utils/time.util';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import { AutomaticPaymentsGapDto } from '../../../settlement/dto/automatic-payments.dto';
import type { AutomaticPaymentsGap } from '../../../settlement/types/automatic-payments.types';
import {
	AccountFundingState,
	BillingAdmissionBlocker,
	BillingForecastMethod,
	DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS,
} from '../../constants/billing.constants';
import type {
	BillingDailyCostDto,
	BillingFundingDto,
	BillingOverviewDto,
} from '../../dto/billing.dto';
import type { BillingBudget } from '../../entities/billing-budget.entity';
import type { OrganizationFunding } from '../../entities/organization-funding.entity';
import type { OrganizationRunway } from '../../services/billing-runway.service';
import { blockingBudgetLimits, budgetLimits } from '../billing-budget.util';
import type { BillingPeriod } from '../billing-period.util';
import { runwayWarning } from '../funding/runway.util';
import { moneyBreakdown } from './billing-forecast.util';

interface BillingOverviewInputs {
	observedAt: Date;
	month: BillingPeriod;
	budget: BillingBudget | null;
	runway: OrganizationRunway;
	startRequirement: MicroUsd;
	state: Pick<OrganizationFunding, 'computeStoppedAt'> | null;
	archivesDeleteAt: Date | null;
	monthSpend: MicroUsd;
	daily: BillingDailyCostDto[];
	automaticPayments: AutomaticPaymentsGap | null;
}

export function billingOverview(
	inputs: BillingOverviewInputs
): BillingOverviewDto {
	const blockers = admissionBlockers(inputs);
	const limits = budgetLimits(inputs.budget);
	return {
		funding: funding(inputs, blockers),
		month: moneyBreakdown({
			actualMicroUsd: inputs.monthSpend,
			committedMicroUsd: inputs.monthSpend,
			forecastMicroUsd: monthForecast(inputs),
			limitMicroUsd: limits.monthlyLimitMicroUsd,
			warningThresholdBasisPoints:
				inputs.budget?.warningThresholdBasisPoints ??
				DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS,
			forecastMethod: BillingForecastMethod.CURRENT_RUN_RATE,
			observationDays: inputs.daily.length,
		}),
		admissionBlockers: blockers,
		automaticPayments: inputs.automaticPayments
			? AutomaticPaymentsGapDto.from(inputs.automaticPayments)
			: null,
		daily: inputs.daily,
		observedAt: inputs.observedAt,
	};
}

function admissionBlockers(
	inputs: BillingOverviewInputs
): BillingAdmissionBlocker[] {
	const blockers: BillingAdmissionBlocker[] = [];
	const { funding: escrow } = inputs.runway;
	if (!escrow.walletReady) {
		blockers.push(BillingAdmissionBlocker.FUNDING_REQUIRED);
	} else if (
		inputs.state?.computeStoppedAt ||
		escrow.spendableMicroUsd.lessThan(inputs.startRequirement)
	) {
		blockers.push(BillingAdmissionBlocker.FUNDING_EXHAUSTED);
	}
	const limit = blockingBudgetLimits(inputs.budget).monthlyLimitMicroUsd;
	if (limit !== null && inputs.monthSpend.atLeast(limit)) {
		blockers.push(BillingAdmissionBlocker.MONTHLY_BUDGET_EXHAUSTED);
	}
	if (inputs.automaticPayments) {
		blockers.push(BillingAdmissionBlocker.AUTOMATIC_PAYMENTS_REQUIRED);
	}
	return blockers;
}

function fundingState(
	inputs: BillingOverviewInputs,
	blockers: readonly BillingAdmissionBlocker[]
): AccountFundingState {
	if (blockers.length > 0) return AccountFundingState.RESTRICTED;
	return runwayWarning(inputs.runway.runwaySeconds) === null
		? AccountFundingState.HEALTHY
		: AccountFundingState.WARNING;
}

function monthForecast(inputs: BillingOverviewInputs): MicroUsd {
	const remainingMilliseconds = BigInt(
		Math.max(0, millisecondsBetween(inputs.observedAt, inputs.month.end))
	);
	return inputs.monthSpend.add(
		inputs.runway.burnMicroUsdPerHour
			.multiply(remainingMilliseconds)
			.divideCeil(BigInt(MILLISECONDS_PER_HOUR))
	);
}

function funding(
	inputs: BillingOverviewInputs,
	blockers: readonly BillingAdmissionBlocker[]
): BillingFundingDto {
	const { runway } = inputs;
	return {
		freeMicroUsd: runway.funding.freeMicroUsd.toString(),
		pendingWithdrawalMicroUsd:
			runway.funding.pendingWithdrawalMicroUsd.toString(),
		outstandingMicroUsd: runway.funding.outstandingMicroUsd.toString(),
		spendableMicroUsd: runway.funding.spendableMicroUsd.toString(),
		computeMicroUsdPerHour: runway.computeMicroUsdPerHour.toString(),
		storageMicroUsdPerHour: runway.storageMicroUsdPerHour.toString(),
		currentBurnMicroUsdPerHour: runway.burnMicroUsdPerHour.toString(),
		runwaySeconds: runway.runwaySeconds?.toString(),
		state: fundingState(inputs, blockers),
		computeStoppedAt: inputs.state?.computeStoppedAt ?? undefined,
		archivesDeleteAt: inputs.archivesDeleteAt ?? undefined,
	};
}
