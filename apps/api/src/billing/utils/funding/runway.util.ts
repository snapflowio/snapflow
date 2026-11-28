/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SECONDS_PER_HOUR } from '../../../common/constants/time.constants';
import { addDays } from '../../../common/utils/time.util';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	FUNDING_POLICY,
	RUNWAY_WARNING_SECONDS,
	RUNWAY_WARNINGS_BY_URGENCY,
	type RunwayWarning,
} from '../../constants/funding.constants';

const HOUR_SECONDS = BigInt(SECONDS_PER_HOUR);

export function coverageMicroUsd(
	burnPerHour: MicroUsd,
	seconds: number
): MicroUsd {
	return burnPerHour.multiply(BigInt(seconds)).divideCeil(HOUR_SECONDS);
}

export function runwaySeconds(
	spendable: MicroUsd,
	burnPerHour: MicroUsd
): bigint | null {
	if (!burnPerHour.isPositive()) return null;
	return spendable.nonnegative().multiply(HOUR_SECONDS).quotient(burnPerHour);
}

export function runwayWarning(runway: bigint | null): RunwayWarning | null {
	if (runway === null) return null;
	return (
		RUNWAY_WARNINGS_BY_URGENCY.find(
			(level) => runway < BigInt(RUNWAY_WARNING_SECONDS[level])
		) ?? null
	);
}

export function warningIsNew(
	current: RunwayWarning,
	lastSent: RunwayWarning | null
): boolean {
	if (lastSent === null) return true;
	return (
		RUNWAY_WARNINGS_BY_URGENCY.indexOf(current) <
		RUNWAY_WARNINGS_BY_URGENCY.indexOf(lastSent)
	);
}

export function fundsExhausted(
	spendable: MicroUsd,
	burnPerHour: MicroUsd,
	stopWindowSeconds: number
): boolean {
	return (
		burnPerHour.isPositive() &&
		spendable.lessThan(coverageMicroUsd(burnPerHour, stopWindowSeconds))
	);
}

export function unfundedArchivesDeleteAt(computeStoppedAt: Date): Date {
	return addDays(computeStoppedAt, FUNDING_POLICY.unfundedArchiveRetentionDays);
}
