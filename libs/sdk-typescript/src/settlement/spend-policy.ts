/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { VoucherRejectionReason } from '../errors/settlement-error.js';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import {
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_MINUTE,
} from '../utils/timeout.js';

const SPEND_RATE_TOLERANCE_MINUTES = 5;

/**
 * Wall time added to every elapsed interval before applying the hourly bound.
 * It absorbs clock skew between this process and Snapflow and the accrual of
 * the usage period that is still open when a voucher is issued.
 */
export const SPEND_RATE_TOLERANCE_MILLISECONDS =
	SPEND_RATE_TOLERANCE_MINUTES * MILLISECONDS_PER_MINUTE;

/** Limits on what one payment channel (one sandbox lease) may charge, in USDC base units (micro-USD). */
export interface VoucherSpendPolicy {
	/** Most a channel's cumulative total may grow per hour of wall time. */
	maxHourlySpend: bigint;
	/** Most a channel's cumulative total may ever reach. */
	maxChannelSpend?: bigint;
}

/** A cumulative total a channel had at a point in wall time (epoch milliseconds). */
export interface SpendAnchor {
	total: bigint;
	at: number;
}

export function assertValidSpendPolicy(policy: VoucherSpendPolicy): void {
	if (policy.maxHourlySpend <= 0n) {
		throw new SnapflowValidationError('maxHourlySpend must be positive');
	}
	if (policy.maxChannelSpend !== undefined && policy.maxChannelSpend <= 0n) {
		throw new SnapflowValidationError('maxChannelSpend must be positive');
	}
}

/** The most a channel may grow over `elapsedMilliseconds` of wall time, tolerance included. */
export function spendAllowance(
	maxHourlySpend: bigint,
	elapsedMilliseconds: number
): bigint {
	const window =
		Math.max(0, Math.trunc(elapsedMilliseconds)) +
		SPEND_RATE_TOLERANCE_MILLISECONDS;
	return (maxHourlySpend * BigInt(window)) / BigInt(MILLISECONDS_PER_HOUR);
}

/**
 * Checks a channel's new cumulative total against the policy. Every anchor
 * bounds the growth since it: anchored at the channel's opening, the
 * tolerance cannot add up over many vouchers; anchored at the last signed
 * voucher, time the channel spent little before it cannot be caught up in
 * one burst.
 */
export function spendPolicyViolation(
	policy: VoucherSpendPolicy,
	total: bigint,
	anchors: readonly SpendAnchor[],
	now: number
): VoucherRejectionReason | undefined {
	if (policy.maxChannelSpend !== undefined && total > policy.maxChannelSpend) {
		return VoucherRejectionReason.ChannelCapExceeded;
	}
	const outrunsRate = anchors.some(
		(anchor) =>
			total - anchor.total >
			spendAllowance(policy.maxHourlySpend, now - anchor.at)
	);
	return outrunsRate ? VoucherRejectionReason.HourlyRateExceeded : undefined;
}
