/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { feeOf } from '@snapflow/contracts';
import type { PaymentChannel } from '../../entities/payment-channel.entity';
import { VoucherLimit } from '../../enums/voucher-limit.enum';
import { maxBigInt } from '../escrow/escrow-amount.util';

export interface PayoutCandidate {
	withdrawableMicroUsd: bigint;
	relayFeeMicroUsd: bigint;
	minimumMicroUsd: bigint;
	draining: boolean;
	signerCapped: boolean;
}

export function isSignerCapped(
	channel: Pick<PaymentChannel, 'voucherError'>
): boolean {
	return channel.voucherError === VoucherLimit.SIGNER_CAP;
}

export function hostShare(amountMicroUsd: bigint, feeBps: number): bigint {
	return amountMicroUsd - feeOf(amountMicroUsd, feeBps);
}

export function netPayout(
	candidate: Pick<PayoutCandidate, 'withdrawableMicroUsd' | 'relayFeeMicroUsd'>
): bigint {
	return maxBigInt(
		0n,
		candidate.withdrawableMicroUsd - candidate.relayFeeMicroUsd
	);
}

export function payoutThreshold(
	candidate: Pick<PayoutCandidate, 'minimumMicroUsd' | 'relayFeeMicroUsd'>
): bigint {
	return candidate.minimumMicroUsd + candidate.relayFeeMicroUsd;
}

export function payoutDue(candidate: PayoutCandidate): boolean {
	const net = netPayout(candidate);
	if (net === 0n) return false;
	return (
		net >= candidate.minimumMicroUsd ||
		candidate.draining ||
		candidate.signerCapped
	);
}
