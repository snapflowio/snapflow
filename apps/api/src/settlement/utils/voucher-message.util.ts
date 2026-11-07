/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type EscrowDomain,
	escrowDomain,
	type snapflowEscrowAbi,
	type Voucher,
} from '@snapflow/contracts';
import { type ContractFunctionArgs, type Hex, isHex } from 'viem';
import { CHANNEL_ID_PATTERN } from '../constants/payment-channel.constants';
import type { PaymentChannel } from '../entities/payment-channel.entity';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import { chainSeconds } from './voucher-schedule.util';

export type VoucherChannel = Pick<
	PaymentChannel,
	| 'chainId'
	| 'contractAddress'
	| 'channelId'
	| 'customerAddress'
	| 'hostAddress'
>;

export type VoucherTerms = Pick<
	PaymentVoucher,
	| 'sequence'
	| 'hostAmountMicroUsd'
	| 'feeAmountMicroUsd'
	| 'serviceAmountMicroUsd'
	| 'expiresAt'
>;

export type SignedVoucher = ContractFunctionArgs<
	typeof snapflowEscrowAbi,
	'nonpayable',
	'claim'
>[0];

// Channel ids are stored the way keccak256 returns them, in lowercase.
export function parseChannelId(value: string): Hex | null {
	const channelId = value.toLowerCase();
	return CHANNEL_ID_PATTERN.test(channelId) && isHex(channelId)
		? channelId
		: null;
}

export function channelDomain(channel: VoucherChannel): EscrowDomain {
	return escrowDomain(channel.chainId, channel.contractAddress);
}

// The EIP-712 message of a stored voucher, exactly as it is signed and claimed.
export function voucherMessage(
	channel: VoucherChannel,
	voucher: VoucherTerms
): Voucher {
	return {
		channelId: channel.channelId,
		customer: channel.customerAddress,
		host: channel.hostAddress,
		hostAmount: BigInt(voucher.hostAmountMicroUsd),
		feeAmount: BigInt(voucher.feeAmountMicroUsd),
		serviceAmount: BigInt(voucher.serviceAmountMicroUsd),
		sequence: BigInt(voucher.sequence),
		expiry: chainSeconds(voucher.expiresAt),
	};
}

export function signedVoucher(
	channel: VoucherChannel,
	voucher: VoucherTerms & Pick<PaymentVoucher, 'signerAddress' | 'signature'>
): SignedVoucher {
	if (voucher.signerAddress === null || voucher.signature === null) {
		throw new Error(
			`Voucher ${voucher.sequence} of channel ${channel.channelId} is not signed`
		);
	}
	return {
		voucher: voucherMessage(channel, voucher),
		signer: voucher.signerAddress,
		signature: voucher.signature,
	};
}
