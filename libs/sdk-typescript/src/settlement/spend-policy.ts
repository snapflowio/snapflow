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

export const SPEND_RATE_TOLERANCE_MILLISECONDS =
	SPEND_RATE_TOLERANCE_MINUTES * MILLISECONDS_PER_MINUTE;

export interface VoucherSpendPolicy {
	maxHourlySpend: bigint;
	maxChannelSpend?: bigint;
}

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

export function spendAllowance(
	maxHourlySpend: bigint,
	elapsedMilliseconds: number
): bigint {
	const window =
		Math.max(0, Math.trunc(elapsedMilliseconds)) +
		SPEND_RATE_TOLERANCE_MILLISECONDS;
	return (maxHourlySpend * BigInt(window)) / BigInt(MILLISECONDS_PER_HOUR);
}

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
