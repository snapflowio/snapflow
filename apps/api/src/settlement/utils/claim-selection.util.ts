/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { millisecondsBetween } from '../../common/utils/time.util';
import type { VoucherAmounts } from '../types/payment-channel.types';
import { amountsExceed } from './voucher-amounts.util';

export interface ClaimCandidate {
	// The latest signed voucher of the channel and what the indexed claims
	// already paid out of it.
	amounts: VoucherAmounts;
	paid: VoucherAmounts;
	claimableUntil: Date;
	// The last claim attempt, or the channel opening before the first one.
	lastAttemptAt: Date;
}

export interface RejectedClaim<Candidate> {
	candidate: Candidate;
	reason: string;
}

export interface IsolatedClaims<Candidate> {
	accepted: Candidate[];
	rejected: RejectedClaim<Candidate>[];
}

// A channel is claimed once per claim interval, and earlier when its voucher
// would stop being claimable before the next regular claim; the vouchers
// closest to that deadline go first.
export function selectClaims<Candidate extends ClaimCandidate>(
	candidates: readonly Candidate[],
	now: Date,
	intervalMilliseconds: number,
	limit: number
): Candidate[] {
	return candidates
		.filter((candidate) => {
			const remaining = millisecondsBetween(now, candidate.claimableUntil);
			const regular =
				millisecondsBetween(candidate.lastAttemptAt, now) >=
				intervalMilliseconds;
			return (
				remaining > 0 &&
				amountsExceed(candidate.amounts, candidate.paid) &&
				(regular || remaining <= intervalMilliseconds)
			);
		})
		.sort(
			(left, right) =>
				left.claimableUntil.getTime() - right.claimableUntil.getTime()
		)
		.slice(0, limit);
}

// Keeps the largest batch the escrow accepts as a whole. simulate returns
// the revert reason of a batch or null when it would succeed; when the whole
// batch fails, each candidate is tried on top of those already accepted, so
// one bad voucher (expired, over a cap, already claimed) never blocks the
// others and the reason recorded is its own.
export async function isolateClaimable<Candidate>(
	candidates: readonly Candidate[],
	simulate: (batch: readonly Candidate[]) => Promise<string | null>
): Promise<IsolatedClaims<Candidate>> {
	if (candidates.length === 0) return { accepted: [], rejected: [] };
	if ((await simulate(candidates)) === null) {
		return { accepted: [...candidates], rejected: [] };
	}
	const accepted: Candidate[] = [];
	const rejected: RejectedClaim<Candidate>[] = [];
	for (const candidate of candidates) {
		const reason = await simulate([...accepted, candidate]);
		if (reason === null) {
			accepted.push(candidate);
		} else {
			rejected.push({ candidate, reason });
		}
	}
	return { accepted, rejected };
}
