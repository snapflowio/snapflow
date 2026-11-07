/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_SECOND,
} from '../../common/constants/time.constants';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { VoucherRejection } from '../enums/voucher-rejection.enum';
import {
	type SessionKeyLimits,
	sessionCommitment,
	sessionRateAllowance,
	sessionSpendRejection,
} from './session-allowance.util';

const ACTIVATED_AT = new Date('2026-11-05T12:00:00.000Z');
const HOURLY_CAP = 1_000n;
const SPEND_CAP = 2_500n;

const KEY: SessionKeyLimits = {
	spendCapMicroUsd: SPEND_CAP.toString(),
	hourlyCapMicroUsd: HOURLY_CAP.toString(),
	activatedAt: ACTIVATED_AT,
	expiresAt: new Date(ACTIVATED_AT.getTime() + 10 * MILLISECONDS_PER_HOUR),
	revokedAt: null,
};

function sinceActivation(milliseconds: number): Date {
	return new Date(ACTIVATED_AT.getTime() + milliseconds);
}

// EscrowSessionKeys._consumeSessionAllowance in whole seconds, as the
// escrow computes it from block timestamps.
function contractAllowance(elapsedSeconds: bigint): bigint {
	return HOURLY_CAP * (elapsedSeconds / 3_600n + 1n);
}

describe('sessionRateAllowance', () => {
	it('allows the hourly cap once per started hour like the escrow', () => {
		for (const elapsedSeconds of [
			0n,
			1n,
			3_599n,
			3_600n,
			3_601n,
			7_200n,
			86_399n,
		]) {
			assert.deepEqual(
				sessionRateAllowance(
					KEY,
					sinceActivation(Number(elapsedSeconds) * MILLISECONDS_PER_SECOND)
				),
				MicroUsd.of(contractAllowance(elapsedSeconds)),
				`after ${elapsedSeconds}s`
			);
		}
	});

	it('ignores the milliseconds the escrow never sees', () => {
		assert.deepEqual(
			sessionRateAllowance(KEY, sinceActivation(MILLISECONDS_PER_HOUR - 1)),
			MicroUsd.of(HOURLY_CAP)
		);
	});

	it('allows one window before the key activates on chain', () => {
		assert.deepEqual(
			sessionRateAllowance(KEY, sinceActivation(-MILLISECONDS_PER_HOUR)),
			MicroUsd.of(HOURLY_CAP)
		);
	});
});

describe('sessionSpendRejection', () => {
	it('accepts a commitment within both limits', () => {
		assert.equal(
			sessionSpendRejection(KEY, MicroUsd.of(HOURLY_CAP), sinceActivation(0)),
			null
		);
	});

	it('refuses beyond the hourly allowance until the next hour starts', () => {
		const committed = MicroUsd.of(HOURLY_CAP + 1n);
		assert.equal(
			sessionSpendRejection(KEY, committed, sinceActivation(0)),
			VoucherRejection.SESSION_HOURLY_CAP_EXCEEDED
		);
		assert.equal(
			sessionSpendRejection(
				KEY,
				committed,
				sinceActivation(MILLISECONDS_PER_HOUR)
			),
			null
		);
	});

	it('refuses beyond the spend cap whatever the allowance', () => {
		assert.equal(
			sessionSpendRejection(
				KEY,
				MicroUsd.of(SPEND_CAP + 1n),
				sinceActivation(5 * MILLISECONDS_PER_HOUR)
			),
			VoucherRejection.SESSION_SPEND_CAP_EXCEEDED
		);
	});

	it('refuses a revoked key and one past its expiry, not one at it', () => {
		assert.equal(
			sessionSpendRejection(
				{ ...KEY, revokedAt: sinceActivation(1) },
				MicroUsd.ZERO,
				sinceActivation(2)
			),
			VoucherRejection.SESSION_KEY_INACTIVE
		);
		assert.equal(
			sessionSpendRejection(
				KEY,
				MicroUsd.ZERO,
				new Date(KEY.expiresAt.getTime() + 1)
			),
			VoucherRejection.SESSION_KEY_INACTIVE
		);
		assert.equal(
			sessionSpendRejection(KEY, MicroUsd.ZERO, KEY.expiresAt),
			null
		);
	});
});

describe('sessionCommitment', () => {
	it('sums what each channel can still charge, replacing the pending one', () => {
		const exposures = [
			{
				paymentChannelId: 'first',
				signedMicroUsd: MicroUsd.of(700n),
				claimedBeforeActivationMicroUsd: MicroUsd.of(500n),
			},
			{
				paymentChannelId: 'second',
				signedMicroUsd: MicroUsd.of(300n),
				claimedBeforeActivationMicroUsd: MicroUsd.of(400n),
			},
			{
				paymentChannelId: 'pending',
				signedMicroUsd: MicroUsd.of(100n),
				claimedBeforeActivationMicroUsd: MicroUsd.of(50n),
			},
		];
		assert.deepEqual(
			sessionCommitment(exposures, {
				paymentChannelId: 'pending',
				signedMicroUsd: MicroUsd.of(150n),
				claimedBeforeActivationMicroUsd: MicroUsd.of(50n),
			}),
			MicroUsd.of(200n + 0n + 100n)
		);
	});
});
