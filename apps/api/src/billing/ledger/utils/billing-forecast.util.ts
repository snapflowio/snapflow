/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BASIS_POINTS_DENOMINATOR,
	BASIS_POINTS_SCALE,
} from '../../../common/constants/money.constants';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	BillingForecastConfidence,
	type BillingForecastMethod,
} from '../constants/billing.constants';
import type { BillingMoneyBreakdownDto } from '../dto/billing.dto';

const LIMITED_FORECAST_OBSERVATION_DAYS = 3;
const MATURE_FORECAST_OBSERVATION_DAYS = 14;

export interface MoneyBreakdownInput {
	actualMicroUsd: MicroUsd;
	committedMicroUsd: MicroUsd;
	forecastMicroUsd: MicroUsd;
	limitMicroUsd: MicroUsd | null;
	warningThresholdBasisPoints: number | undefined;
	forecastMethod: BillingForecastMethod;
	observationDays: number;
}

export function moneyBreakdown(
	input: MoneyBreakdownInput
): BillingMoneyBreakdownDto {
	const hasLimit = input.limitMicroUsd !== null;
	return {
		actualMicroUsd: input.actualMicroUsd.toString(),
		committedMicroUsd: input.committedMicroUsd.toString(),
		forecastMicroUsd: input.forecastMicroUsd.toString(),
		forecastMethod: input.forecastMethod,
		forecastConfidence: forecastConfidence(input.observationDays),
		forecastObservationDays: input.observationDays,
		limitMicroUsd: input.limitMicroUsd?.toString(),
		utilizationBasisPoints: budgetUtilizationBasisPoints(
			input.committedMicroUsd,
			input.limitMicroUsd
		),
		warningThresholdBasisPoints: hasLimit
			? input.warningThresholdBasisPoints
			: undefined,
	};
}

function forecastConfidence(
	observationDays: number
): BillingForecastConfidence {
	if (observationDays < LIMITED_FORECAST_OBSERVATION_DAYS) {
		return BillingForecastConfidence.LIMITED;
	}
	if (observationDays < MATURE_FORECAST_OBSERVATION_DAYS) {
		return BillingForecastConfidence.DEVELOPING;
	}
	return BillingForecastConfidence.MATURE;
}

function budgetUtilizationBasisPoints(
	committed: MicroUsd,
	limit: MicroUsd | null
): number | undefined {
	if (limit === null) return undefined;
	if (limit.isZero()) return committed.isZero() ? 0 : BASIS_POINTS_SCALE;
	return Number(
		committed.nonnegative().multiply(BASIS_POINTS_DENOMINATOR).quotient(limit)
	);
}
