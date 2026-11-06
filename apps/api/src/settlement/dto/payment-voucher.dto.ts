/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsEthereumAddress,
	IsInt,
	Matches,
	MaxLength,
	Min,
} from 'class-validator';
import type { Address, Hex } from 'viem';
import { CHANNEL_ID_PATTERN } from '../constants/payment-channel.constants';
import {
	PAYMENT_WALLET_LIMITS,
	SIGNATURE_PATTERN,
} from '../constants/payment-wallet.constants';
import {
	EVM_ADDRESS_API_PROPERTY,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import {
	type VoucherChannel,
	voucherMessage,
} from '../utils/voucher-message.util';

// The EIP-712 Voucher message, with every integer as a decimal string.
@ApiSchema({ name: 'VoucherMessage' })
export class VoucherMessageDto {
	@ApiProperty({ type: String, pattern: CHANNEL_ID_PATTERN.source })
	channelId: Hex;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	customer: Address;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	host: Address;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Cumulative host share, in USDC base units (micro-USD)',
	})
	hostAmount: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Cumulative Snapflow fee, in USDC base units',
	})
	feeAmount: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Cumulative platform service charges, in USDC base units',
	})
	serviceAmount: string;

	@ApiProperty(UINT_STRING_API_PROPERTY)
	sequence: string;

	@ApiProperty({ ...UINT_STRING_API_PROPERTY, description: 'Unix seconds' })
	expiry: string;

	static from(
		channel: VoucherChannel,
		voucher: PaymentVoucher
	): VoucherMessageDto {
		const message = voucherMessage(channel, voucher);
		return {
			channelId: message.channelId,
			customer: message.customer,
			host: message.host,
			hostAmount: message.hostAmount.toString(),
			feeAmount: message.feeAmount.toString(),
			serviceAmount: message.serviceAmount.toString(),
			sequence: message.sequence.toString(),
			expiry: message.expiry.toString(),
		};
	}
}

@ApiSchema({ name: 'PaymentVoucher' })
export class PaymentVoucherDto {
	@ApiProperty({ type: 'integer' })
	sequence: number;

	@ApiProperty({ type: VoucherMessageDto })
	message: VoucherMessageDto;

	@ApiProperty({ type: String, format: 'date-time' })
	issuedAt: Date;

	@ApiProperty({ type: String, format: 'date-time' })
	expiresAt: Date;

	@ApiProperty({ ...EVM_ADDRESS_API_PROPERTY, nullable: true })
	signerAddress: Address | null;

	@ApiProperty({ type: String, nullable: true })
	signature: Hex | null;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	signedAt: Date | null;

	static from(
		channel: VoucherChannel,
		voucher: PaymentVoucher
	): PaymentVoucherDto {
		return {
			sequence: voucher.sequence,
			message: VoucherMessageDto.from(channel, voucher),
			issuedAt: voucher.issuedAt,
			expiresAt: voucher.expiresAt,
			signerAddress: voucher.signerAddress,
			signature: voucher.signature,
			signedAt: voucher.signedAt,
		};
	}
}

@ApiSchema({ name: 'SubmitVoucherSignature' })
export class SubmitVoucherSignatureDto {
	@ApiProperty({ type: String, pattern: CHANNEL_ID_PATTERN.source })
	@Matches(CHANNEL_ID_PATTERN)
	channelId: Hex;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	sequence: number;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description:
			'The funding wallet itself or one of its session keys that signed the voucher',
	})
	@IsEthereumAddress()
	signer: Address;

	@ApiProperty({
		type: String,
		description: 'EIP-712 signature of the voucher message',
		pattern: SIGNATURE_PATTERN.source,
		maxLength: PAYMENT_WALLET_LIMITS.SIGNATURE_MAX_LENGTH,
	})
	@Matches(SIGNATURE_PATTERN)
	@MaxLength(PAYMENT_WALLET_LIMITS.SIGNATURE_MAX_LENGTH)
	signature: Hex;
}
