/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MAX_FEE_BPS,
	MAX_RELAY_FEE,
	snapflowEscrowAbi,
} from '@snapflow/contracts';
import {
	type Address,
	bytesToHex,
	encodeFunctionData,
	type Hex,
	maxUint8,
	maxUint64,
	maxUint128,
} from 'viem';
import type { HostSettlement } from '../../entities/host-settlement.entity';
import type { PaymentChannel } from '../../entities/payment-channel.entity';
import type { PaymentVoucher } from '../../entities/payment-voucher.entity';
import type { EscrowClaimItem } from '../../types/escrow.types';
import type { HostSettlementItem } from '../../types/host-settlement.types';
import { chainSeconds, microUsd } from '../escrow/escrow-amount.util';
import { voucherMessage } from '../vouchers/voucher-message.util';

type SettlementWithdrawal = Pick<
	HostSettlement,
	| 'hostAddress'
	| 'payoutAddress'
	| 'relayFeeMicroUsd'
	| 'deadline'
	| 'signature'
>;

export function settlementItem(
	channel: PaymentChannel,
	voucher: PaymentVoucher
): HostSettlementItem {
	return {
		paymentChannelId: channel.id,
		voucherId: voucher.id,
		maxAmountMicroUsd: (
			microUsd(voucher.cumulativeMicroUsd) - microUsd(channel.claimedMicroUsd)
		).toString(),
	};
}

export function escrowClaimItem(
	channel: PaymentChannel,
	voucher: PaymentVoucher,
	maxAmountMicroUsd: string
): EscrowClaimItem {
	if (voucher.signature === null || voucher.signerAddress === null) {
		throw new Error(`Voucher ${voucher.id} is not signed`);
	}
	return {
		voucher: voucherMessage(channel, voucher),
		signature: voucher.signature,
		signer: voucher.signerAddress,
		maxAmount: microUsd(maxAmountMicroUsd),
	};
}

export function hostSettlementCalldata(
	settlement: SettlementWithdrawal,
	items: readonly EscrowClaimItem[]
): Hex {
	const withdrawal = [
		settlement.hostAddress,
		settlement.payoutAddress,
		microUsd(settlement.relayFeeMicroUsd),
		chainSeconds(settlement.deadline),
		settlement.signature,
	] as const;
	return items.length === 0
		? encodeFunctionData({
				abi: snapflowEscrowAbi,
				functionName: 'withdrawHostWithSig',
				args: withdrawal,
			})
		: encodeFunctionData({
				abi: snapflowEscrowAbi,
				functionName: 'claimBatchAndWithdraw',
				args: [items, ...withdrawal],
			});
}

const PLACEHOLDER_BYTES = {
	ADDRESS: 20,
	WORD: 32,
	SIGNATURE: 65,
} as const;

const PLACEHOLDER_DEADLINE = new Date(0);

function placeholderBytes(length: number): Hex {
	return bytesToHex(new Uint8Array(length).fill(Number(maxUint8)));
}

export function placeholderHostSettlementCalldata(claims: number): Hex {
	const address: Address = placeholderBytes(PLACEHOLDER_BYTES.ADDRESS);
	const item: EscrowClaimItem = {
		voucher: {
			customer: address,
			host: address,
			feeReceiver: address,
			feeBps: MAX_FEE_BPS,
			salt: placeholderBytes(PLACEHOLDER_BYTES.WORD),
			cumulativeAmount: maxUint128,
			timestamp: maxUint64,
			metadata: placeholderBytes(PLACEHOLDER_BYTES.WORD),
		},
		signature: placeholderBytes(PLACEHOLDER_BYTES.SIGNATURE),
		signer: address,
		maxAmount: maxUint128,
	};
	return hostSettlementCalldata(
		{
			hostAddress: address,
			payoutAddress: address,
			relayFeeMicroUsd: MAX_RELAY_FEE.toString(),
			deadline: PLACEHOLDER_DEADLINE,
			signature: placeholderBytes(PLACEHOLDER_BYTES.SIGNATURE),
		},
		Array.from({ length: claims }, () => item)
	);
}
