/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { millisecondsBetween } from '../../common/utils/time.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { SESSION_RATE_WINDOW_MILLISECONDS } from '../constants/payment-channel.constants';
import type { EscrowSessionKey } from '../entities/escrow-session-key.entity';
import { VoucherRejection } from '../enums/voucher-rejection.enum';

export type SessionKeyLimits = Pick<
	EscrowSessionKey,
	| 'spendCapMicroUsd'
	| 'hourlyCapMicroUsd'
	| 'activatedAt'
	| 'expiresAt'
	| 'revokedAt'
>;

// What one channel can still make the escrow charge a session key: the
// latest voucher the key signed there, less what the channel had paid
// before the key was (re)activated, since the escrow resets a key's spend
// when it is set and only charges claims made after that.
export interface SessionExposure {
	paymentChannelId: string;
	signedMicroUsd: MicroUsd;
	claimedBeforeActivationMicroUsd: MicroUsd;
}

// EscrowSessionKeys._consumeSessionAllowance: hourlyCap for every started
// hour since activation.
export function sessionRateAllowance(
	key: Pick<SessionKeyLimits, 'hourlyCapMicroUsd' | 'activatedAt'>,
	now: Date
): MicroUsd {
	const elapsedMilliseconds = Math.max(
		0,
		millisecondsBetween(key.activatedAt, now)
	);
	const windows =
		BigInt(Math.floor(elapsedMilliseconds / SESSION_RATE_WINDOW_MILLISECONDS)) +
		1n;
	return MicroUsd.parse(key.hourlyCapMicroUsd).multiply(windows);
}

// Everything the key would be charged once every voucher it signed is
// claimed, with pending replacing what the key signed on its channel so far.
export function sessionCommitment(
	exposures: readonly SessionExposure[],
	pending: SessionExposure
): MicroUsd {
	const unclaimed = (exposure: SessionExposure) =>
		exposure.signedMicroUsd
			.subtract(exposure.claimedBeforeActivationMicroUsd)
			.nonnegative();
	return MicroUsd.sum(
		exposures
			.filter(
				(exposure) => exposure.paymentChannelId !== pending.paymentChannelId
			)
			.map(unclaimed)
	).add(unclaimed(pending));
}

// The escrow refuses a claim through an expired or revoked key and one that
// would take the key past either limit.
export function sessionSpendRejection(
	key: SessionKeyLimits,
	committedMicroUsd: MicroUsd,
	now: Date
): VoucherRejection | null {
	if (key.revokedAt !== null || key.expiresAt.getTime() < now.getTime()) {
		return VoucherRejection.SESSION_KEY_INACTIVE;
	}
	if (committedMicroUsd.greaterThan(MicroUsd.parse(key.spendCapMicroUsd))) {
		return VoucherRejection.SESSION_SPEND_CAP_EXCEEDED;
	}
	if (committedMicroUsd.greaterThan(sessionRateAllowance(key, now))) {
		return VoucherRejection.SESSION_HOURLY_CAP_EXCEEDED;
	}
	return null;
}
