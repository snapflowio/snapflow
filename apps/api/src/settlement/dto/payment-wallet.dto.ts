/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import type { Address, Hex } from 'viem';
import {
	PAYMENT_WALLET_LIMITS,
	SIGNATURE_PATTERN,
	SIWE_MESSAGE_VERSION,
} from '../constants/payment-wallet.constants';
import { EVM_ADDRESS_API_PROPERTY } from '../constants/settlement.constants';
import type { PaymentWallet } from '../entities/payment-wallet.entity';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { SanctionsStatus } from '../enums/sanctions-status.enum';

const PURPOSE_PROPERTY = {
	enum: PaymentWalletPurpose,
	enumName: 'PaymentWalletPurpose',
	description:
		'funding: the customer wallet that deposits into the escrow and signs vouchers; payout: the host wallet that receives claims',
} as const;

const ADDRESS_EXAMPLE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

@ApiSchema({ name: 'WalletPurposeRequest' })
export class WalletPurposeRequestDto {
	@ApiProperty(PURPOSE_PROPERTY)
	@IsEnum(PaymentWalletPurpose)
	purpose: PaymentWalletPurpose;
}

export class PaymentWalletPurposeParamsDto {
	@ApiProperty({
		enum: PaymentWalletPurpose,
		enumName: PURPOSE_PROPERTY.enumName,
	})
	@IsEnum(PaymentWalletPurpose)
	purpose: PaymentWalletPurpose;
}

@ApiSchema({ name: 'SiweNonce' })
export class SiweNonceDto {
	@ApiProperty({ description: "The dashboard's host, the message domain" })
	domain: string;

	@ApiProperty({ description: "The dashboard's URL, the message URI" })
	uri: string;

	@ApiProperty({ type: 'integer' })
	chainId: number;

	@ApiProperty()
	statement: string;

	@ApiProperty({ enum: [SIWE_MESSAGE_VERSION] })
	version: typeof SIWE_MESSAGE_VERSION;

	@ApiProperty({
		description:
			'Single-use; bound to the organization and purpose, or to you for a recovery owner',
	})
	nonce: string;

	@ApiProperty({ type: String, format: 'date-time' })
	issuedAt: Date;

	@ApiProperty({
		type: String,
		format: 'date-time',
		description:
			'When the nonce expires; use it as the message expiration time',
	})
	expirationTime: Date;
}

@ApiSchema({ name: 'SiweProof' })
export class SiweProofDto {
	@ApiProperty({
		description:
			'The ERC-4361 message the wallet signed, built from the fields of a SIWE nonce',
		maxLength: PAYMENT_WALLET_LIMITS.MESSAGE_MAX_LENGTH,
	})
	@IsString()
	@MaxLength(PAYMENT_WALLET_LIMITS.MESSAGE_MAX_LENGTH)
	message: string;

	@ApiProperty({
		type: String,
		description:
			'Signature of the message; ERC-1271 and ERC-6492 smart wallet signatures are accepted',
		pattern: SIGNATURE_PATTERN.source,
		maxLength: PAYMENT_WALLET_LIMITS.SIGNATURE_MAX_LENGTH,
	})
	@Matches(SIGNATURE_PATTERN)
	@MaxLength(PAYMENT_WALLET_LIMITS.SIGNATURE_MAX_LENGTH)
	signature: Hex;
}

@ApiSchema({ name: 'LinkPaymentWallet' })
export class LinkPaymentWalletDto extends IntersectionType(
	WalletPurposeRequestDto,
	SiweProofDto
) {}

@ApiSchema({ name: 'PaymentWallet' })
export class PaymentWalletDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty(PURPOSE_PROPERTY)
	purpose: PaymentWalletPurpose;

	@ApiProperty({ ...EVM_ADDRESS_API_PROPERTY, example: ADDRESS_EXAMPLE })
	address: Address;

	@ApiProperty({ type: String, format: 'date-time' })
	verifiedAt: Date;

	@ApiProperty({ enum: SanctionsStatus, enumName: 'SanctionsStatus' })
	sanctionsStatus: SanctionsStatus;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	sanctionsCheckedAt: Date | null;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: Date;

	@ApiProperty({ type: String, format: 'date-time' })
	updatedAt: Date;

	static from(wallet: PaymentWallet): PaymentWalletDto {
		return {
			id: wallet.id,
			purpose: wallet.purpose,
			address: wallet.address,
			verifiedAt: wallet.verifiedAt,
			sanctionsStatus: wallet.sanctionsStatus,
			sanctionsCheckedAt: wallet.sanctionsCheckedAt,
			createdAt: wallet.createdAt,
			updatedAt: wallet.updatedAt,
		};
	}
}
