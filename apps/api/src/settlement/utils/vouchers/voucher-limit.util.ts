/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { VoucherLimit } from '../../enums/voucher-limit.enum';
import { maxBigInt } from '../escrow/escrow-amount.util';

interface VoucherBounds {
	charged: bigint;
	previous: bigint;
	balanceBound: bigint;
	signerBound: bigint | null;
}

interface SignableVoucher {
	cumulative: bigint;
	limitedBy: VoucherLimit | null;
}

export function signableCumulative(bounds: VoucherBounds): SignableVoucher {
	const limits: [VoucherLimit, bigint][] = [
		[VoucherLimit.CUSTOMER_BALANCE, bounds.balanceBound],
	];
	if (bounds.signerBound !== null) {
		limits.push([VoucherLimit.SIGNER_CAP, bounds.signerBound]);
	}
	let cumulative = bounds.charged;
	let limitedBy: VoucherLimit | null = null;
	for (const [limit, bound] of limits) {
		if (bound < cumulative) {
			cumulative = bound;
			limitedBy = limit;
		}
	}
	return { cumulative: maxBigInt(cumulative, bounds.previous), limitedBy };
}

export function channelBound(
	remaining: bigint,
	otherChannelsOutstanding: bigint,
	claimed: bigint
): bigint {
	return claimed + maxBigInt(0n, remaining - otherChannelsOutstanding);
}
