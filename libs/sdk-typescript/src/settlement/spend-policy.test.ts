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
	assertValidSpendPolicy,
	SPEND_RATE_TOLERANCE_MILLISECONDS,
	spendAllowance,
	spendPolicyViolation,
} from './spend-policy.js';

const HOUR_MILLISECONDS = 3_600_000;
const MAX_HOURLY_SPEND = 1_200_000n;
const NOW = 1_800_000_000_000;
const TOLERANCE_ALLOWANCE =
	(MAX_HOURLY_SPEND * BigInt(SPEND_RATE_TOLERANCE_MILLISECONDS)) /
	BigInt(HOUR_MILLISECONDS);
const policy = { maxHourlySpend: MAX_HOURLY_SPEND };

describe('spendAllowance', () => {
	it('grants the hourly rate over the elapsed time plus the tolerance', () => {
		expect(spendAllowance(MAX_HOURLY_SPEND, HOUR_MILLISECONDS)).toBe(
			MAX_HOURLY_SPEND + TOLERANCE_ALLOWANCE
		);
	});

	it('treats a start in the future, from clock skew, as no elapsed time', () => {
		expect(spendAllowance(MAX_HOURLY_SPEND, -HOUR_MILLISECONDS)).toBe(
			TOLERANCE_ALLOWANCE
		);
	});
});

describe('spendPolicyViolation', () => {
	const openedAnHourAgo = { total: 0n, at: NOW - HOUR_MILLISECONDS };

	it('accepts growth within the hourly rate', () => {
		expect(
			spendPolicyViolation(policy, MAX_HOURLY_SPEND, [openedAnHourAgo], NOW)
		).toBeUndefined();
	});

	it('accepts growth up to the tolerance above the hourly rate', () => {
		expect(
			spendPolicyViolation(
				policy,
				MAX_HOURLY_SPEND + TOLERANCE_ALLOWANCE,
				[openedAnHourAgo],
				NOW
			)
		).toBeUndefined();
	});

	it('refuses growth beyond the hourly rate and tolerance', () => {
		expect(
			spendPolicyViolation(
				policy,
				MAX_HOURLY_SPEND + TOLERANCE_ALLOWANCE + 1n,
				[openedAnHourAgo],
				NOW
			)
		).toBe(VoucherRejectionReason.HourlyRateExceeded);
	});

	it('refuses a burst after the last signed voucher even when the lifetime rate allows it', () => {
		const openedLongAgo = { total: 0n, at: NOW - 10 * HOUR_MILLISECONDS };
		const signedJustNow = { total: 0n, at: NOW };

		expect(
			spendPolicyViolation(
				policy,
				MAX_HOURLY_SPEND,
				[openedLongAgo, signedJustNow],
				NOW
			)
		).toBe(VoucherRejectionReason.HourlyRateExceeded);
	});

	it('refuses a total above the channel cap', () => {
		expect(
			spendPolicyViolation(
				{ ...policy, maxChannelSpend: MAX_HOURLY_SPEND - 1n },
				MAX_HOURLY_SPEND,
				[openedAnHourAgo],
				NOW
			)
		).toBe(VoucherRejectionReason.ChannelCapExceeded);
	});
});

describe('assertValidSpendPolicy', () => {
	it('refuses limits that are not positive', () => {
		expect(() => assertValidSpendPolicy({ maxHourlySpend: 0n })).toThrow(
			SnapflowValidationError
		);
		expect(() =>
			assertValidSpendPolicy({ ...policy, maxChannelSpend: 0n })
		).toThrow(SnapflowValidationError);
	});
});
