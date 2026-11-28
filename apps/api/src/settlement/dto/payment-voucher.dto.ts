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
	IsUUID,
	Matches,
	MaxLength,
	Min,
} from 'class-validator';
import type { Address, Hex } from 'viem';
import {
	PAYMENT_WALLET_LIMITS,
	SIGNATURE_PATTERN,
} from '../constants/payment-wallet.constants';
import {
	EVM_ADDRESS_API_PROPERTY,
	EVM_HASH_PATTERN,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import { voucherMessage } from '../utils/vouchers/voucher-message.util';

const BYTES32_PROPERTY = {
	type: String,
	pattern: EVM_HASH_PATTERN.source,
} as const;

@ApiSchema({ name: 'VoucherMessage' })
export class VoucherMessageDto {
	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'Paying funding wallet',
	})
	customer: Address;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description:
			"Paid host: a machine's host key, or Snapflow's platform receiver",
	})
	host: Address;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	feeReceiver: Address;

	@ApiProperty({
		type: 'integer',
		description: 'Fee share of every claim, in basis points',
	})
	feeBps: number;

	@ApiProperty({ ...BYTES32_PROPERTY, description: 'The channel salt' })
	salt: Hex;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'Total the host may claim over the channel, fee included, in USDC base units (micro-USD)',
	})
	cumulativeAmount: string;

	@ApiProperty({ ...UINT_STRING_API_PROPERTY, description: 'Unix seconds' })
	timestamp: string;

	@ApiProperty({
		...BYTES32_PROPERTY,
		description:
			'Commitment to the usage receipt chains of the sandboxes the channel paid for when the voucher was issued',
	})
	metadata: Hex;

	static from(
		channel: Parameters<typeof voucherMessage>[0],
		voucher: PaymentVoucher
	): VoucherMessageDto {
		const message = voucherMessage(channel, voucher);
		return {
			...message,
			cumulativeAmount: message.cumulativeAmount.toString(),
			timestamp: message.timestamp.toString(),
		};
	}
}

@ApiSchema({ name: 'PaymentVoucher' })
export class PaymentVoucherDto {
	@ApiProperty({ type: 'integer' })
	sequence: number;

	@ApiProperty({ type: VoucherMessageDto })
	message: VoucherMessageDto;

	@ApiProperty({
		...BYTES32_PROPERTY,
		description: "EIP-712 digest, equal to the escrow's voucherDigest",
	})
	digest: Hex;

	@ApiProperty({ type: String, format: 'date-time' })
	issuedAt: Date;

	@ApiProperty({ ...EVM_ADDRESS_API_PROPERTY, nullable: true })
	signerAddress: Address | null;

	@ApiProperty({ type: String, nullable: true })
	signature: Hex | null;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	signedAt: Date | null;

	static from(
		channel: Parameters<typeof voucherMessage>[0],
		voucher: PaymentVoucher
	): PaymentVoucherDto {
		return {
			sequence: voucher.sequence,
			message: VoucherMessageDto.from(channel, voucher),
			digest: voucher.digest,
			issuedAt: voucher.createdAt,
			signerAddress: voucher.signerAddress,
			signature: voucher.signature,
			signedAt: voucher.signedAt,
		};
	}
}

@ApiSchema({ name: 'SubmitVoucherSignature' })
export class SubmitVoucherSignatureDto {
	@ApiProperty({ format: 'uuid', description: 'The payment channel' })
	@IsUUID()
	paymentChannelId: string;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	sequence: number;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description:
			'The funding wallet itself or one of the signer keys it authorized in the escrow',
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
