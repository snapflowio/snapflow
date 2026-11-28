/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EscrowClaimsFreeze } from '../../entities/escrow-claims-freeze.entity';
import { chainSeconds, minBigInt } from './escrow-amount.util';

export type ClaimsFreezeState = Pick<
	EscrowClaimsFreeze,
	'frozenSince' | 'frozenUntil' | 'accumulatedSeconds'
>;

function elapsedFrozen(freeze: ClaimsFreezeState, at: bigint): bigint {
	const since = chainSeconds(freeze.frozenSince);
	const end = minBigInt(at, chainSeconds(freeze.frozenUntil));
	return end > since ? end - since : 0n;
}

function frozenSecondsAt(freeze: ClaimsFreezeState | null, at: bigint): bigint {
	if (freeze === null) return 0n;
	return BigInt(freeze.accumulatedSeconds) + elapsedFrozen(freeze, at);
}

export function unfrozenSecondsAt(
	freeze: ClaimsFreezeState | null,
	at: Date
): bigint {
	const seconds = chainSeconds(at);
	return seconds - frozenSecondsAt(freeze, seconds);
}

export function nextClaimsFreeze(
	previous: ClaimsFreezeState | null,
	since: Date,
	until: Date
): ClaimsFreezeState {
	return {
		frozenSince: since,
		frozenUntil: until,
		accumulatedSeconds: Number(frozenSecondsAt(previous, chainSeconds(since))),
	};
}

export function claimsFrozenAt(
	freeze: ClaimsFreezeState | null,
	at: Date
): boolean {
	return freeze !== null && freeze.frozenSince <= at && at < freeze.frozenUntil;
}
