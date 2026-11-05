/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MILLISECONDS_PER_HOUR,
	MINUTES_PER_HOUR,
} from '../../common/constants/time.constants';
import { millisecondsBetween } from '../../common/utils/time.util';
import { BasisPoints } from '../../common/values/basis-points.value';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	BillingForecastMethod,
	DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS,
} from '../constants/billing.constants';
import type {
	BillingDailyCostDto,
	BillingFundingDto,
	BillingOverviewDto,
} from '../dto/billing.dto';
import type { BillingBudget } from '../entities/billing-budget.entity';
import type { MonthSpend } from '../queries/billing-admission.query';
import type { ActiveReservation } from '../queries/billing-overview.query';
import {
	accountFundingState,
	type BillingAdmissionInput,
	billingAdmissionBlockers,
} from './billing-admission.util';
import { blockingBudgetLimits, budgetLimits } from './billing-budget.util';
import { evaluateBillingCapacity } from './billing-capacity.util';
import { moneyBreakdown } from './billing-forecast.util';
import type { BillingPeriod } from './billing-period.util';
import {
	minimumAdmissionReservationMicroUsd,
	unusedReservedMicroUsd,
} from './ledger/billing-reservation.util';

export interface BillingOverviewInputs {
	observedAt: Date;
	month: BillingPeriod;
	budget: BillingBudget | null;
	creditBalance: MicroUsd;
	spend: MonthSpend;
	unposted: MicroUsd;
	reservations: ActiveReservation[];
	daily: BillingDailyCostDto[];
	liveAccrualByPlacementId: Map<string, MicroUsd>;
	minimumRunwayMinutes: bigint;
	networkReservation: MicroUsd;
}

interface BillingOverviewFigures {
	liveAccrual: MicroUsd;
	unusedReserved: MicroUsd;
	available: MicroUsd;
	committed: MicroUsd;
	burnPerHour: MicroUsd;
	runwayMinutes: bigint | undefined;
	forecast: MicroUsd;
}

export function billingOverview(
	inputs: BillingOverviewInputs
): BillingOverviewDto {
	const figures = overviewFigures(inputs);
	const admission = admissionInput(inputs, figures);
	const limits = budgetLimits(inputs.budget);
	const warningThresholdBasisPoints = warningThreshold(inputs.budget);
	const observationDays = inputs.daily.length;
	return {
		funding: funding(inputs, figures, admission),
		month: moneyBreakdown({
			actualMicroUsd: inputs.spend.totalMicroUsd,
			committedMicroUsd: figures.committed,
			forecastMicroUsd: figures.forecast,
			limitMicroUsd: limits.monthlyLimitMicroUsd,
			warningThresholdBasisPoints,
			forecastMethod: BillingForecastMethod.CURRENT_RESERVED_RUN_RATE,
			observationDays,
		}),
		network: moneyBreakdown({
			actualMicroUsd: inputs.spend.networkMicroUsd,
			committedMicroUsd: inputs.spend.networkMicroUsd,
			forecastMicroUsd: inputs.spend.networkMicroUsd,
			limitMicroUsd: limits.networkLimitMicroUsd,
			warningThresholdBasisPoints,
			forecastMethod: BillingForecastMethod.ACTUAL_ONLY,
			observationDays,
		}),
		admissionBlockers: billingAdmissionBlockers(admission),
		daily: inputs.daily,
		observedAt: inputs.observedAt,
	};
}

function overviewFigures(
	inputs: BillingOverviewInputs
): BillingOverviewFigures {
	const liveAccrual = MicroUsd.sum(inputs.liveAccrualByPlacementId.values());
	const unusedReserved = unusedReservedMicroUsd(
		inputs.reservations,
		inputs.liveAccrualByPlacementId
	);
	const blockingLimits = blockingBudgetLimits(inputs.budget);
	const reservationCommitment = liveAccrual.add(unusedReserved);
	const capacity = evaluateBillingCapacity({
		creditBalanceMicroUsd: inputs.creditBalance,
		unpostedChargesMicroUsd: inputs.unposted,
		reservedUsageMicroUsd: reservationCommitment,
		requestedMicroUsd: reservationCommitment,
		monthSpendMicroUsd: inputs.spend.totalMicroUsd,
		monthlyLimitMicroUsd: blockingLimits.monthlyLimitMicroUsd,
		networkMonthSpendMicroUsd: inputs.spend.networkMicroUsd,
		networkRequestedMicroUsd: MicroUsd.ZERO,
		networkLimitMicroUsd: blockingLimits.networkLimitMicroUsd,
	});
	const available = capacity.availableMicroUsd;
	const burnPerHour = hourlyBurn(inputs.reservations);
	return {
		liveAccrual,
		unusedReserved,
		available,
		committed: capacity.monthlyCommittedMicroUsd,
		burnPerHour,
		runwayMinutes: burnPerHour.isZero()
			? undefined
			: available.multiply(BigInt(MINUTES_PER_HOUR)).quotient(burnPerHour),
		forecast: monthForecast(inputs, liveAccrual, burnPerHour),
	};
}

function hourlyBurn(reservations: readonly ActiveReservation[]): MicroUsd {
	return MicroUsd.sum(
		reservations
			.filter((reservation) =>
				MicroUsd.parse(reservation.remainingReservedMicroUsd).isPositive()
			)
			.map((reservation) => MicroUsd.parse(reservation.estimatedHourlyMicroUsd))
	);
}

function monthForecast(
	inputs: BillingOverviewInputs,
	liveAccrual: MicroUsd,
	burnPerHour: MicroUsd
): MicroUsd {
	const remainingMilliseconds = BigInt(
		Math.max(0, millisecondsBetween(inputs.observedAt, inputs.month.end))
	);
	return inputs.spend.totalMicroUsd
		.add(liveAccrual)
		.add(
			burnPerHour
				.multiply(remainingMilliseconds)
				.divideCeil(BigInt(MILLISECONDS_PER_HOUR))
		);
}

function warningThreshold(budget: BillingBudget | null): number {
	return (
		budget?.warningThresholdBasisPoints ??
		DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS
	);
}

function admissionInput(
	inputs: BillingOverviewInputs,
	figures: BillingOverviewFigures
): BillingAdmissionInput {
	return {
		creditBalanceMicroUsd: inputs.creditBalance,
		hasBillingActivity:
			inputs.spend.totalMicroUsd.isPositive() ||
			inputs.unposted.isPositive() ||
			figures.liveAccrual.isPositive() ||
			figures.unusedReserved.isPositive(),
		availableMicroUsd: figures.available,
		minimumReservationMicroUsd: minimumAdmissionReservationMicroUsd(
			inputs.networkReservation,
			inputs.minimumRunwayMinutes
		),
		monthlyCommittedMicroUsd: figures.committed,
		networkCommittedMicroUsd: inputs.spend.networkMicroUsd,
		budget: inputs.budget,
		warningThresholdBasisPoints: BasisPoints.of(
			warningThreshold(inputs.budget)
		),
		runwayMinutes: figures.runwayMinutes,
		minimumRunwayMinutes: inputs.minimumRunwayMinutes,
	};
}

function funding(
	inputs: BillingOverviewInputs,
	figures: BillingOverviewFigures,
	admission: BillingAdmissionInput
): BillingFundingDto {
	return {
		creditBalanceMicroUsd: inputs.creditBalance.toString(),
		unpostedChargesMicroUsd: inputs.unposted.toString(),
		liveAccrualMicroUsd: figures.liveAccrual.toString(),
		reservationsMicroUsd: figures.unusedReserved.toString(),
		projectedAvailableMicroUsd: figures.available.toString(),
		currentBurnMicroUsdPerHour: figures.burnPerHour.toString(),
		runwayMinutes: figures.runwayMinutes?.toString(),
		state: accountFundingState(admission),
	};
}
