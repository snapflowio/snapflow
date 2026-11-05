/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
	IsEnum,
	IsEthereumAddress,
	IsString,
	Matches,
	MaxLength,
} from 'class-validator';
import type { Address, Hex } from 'viem';
import {
	PAYMENT_WALLET_LIMITS,
	SIGNATURE_PATTERN,
} from '../constants/payment-wallet.constants';
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

@ApiSchema({ name: 'CreateWalletChallenge' })
export class CreateWalletChallengeDto {
	@ApiProperty(PURPOSE_PROPERTY)
	@IsEnum(PaymentWalletPurpose)
	purpose: PaymentWalletPurpose;

	@ApiProperty({
		type: String,
		description: 'Address of the wallet to link',
		example: ADDRESS_EXAMPLE,
	})
	@IsEthereumAddress()
	address: Address;
}

@ApiSchema({ name: 'WalletChallenge' })
export class WalletChallengeDto {
	@ApiProperty({
		description:
			'Sign-In With Ethereum (EIP-4361) message the wallet must sign with personal_sign',
	})
	message: string;

	@ApiProperty({ type: String, format: 'date-time' })
	expiresAt: Date;
}

@ApiSchema({ name: 'LinkPaymentWallet' })
export class LinkPaymentWalletDto {
	@ApiProperty(PURPOSE_PROPERTY)
	@IsEnum(PaymentWalletPurpose)
	purpose: PaymentWalletPurpose;

	@ApiProperty({
		description: 'The challenge message exactly as issued',
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

@ApiSchema({ name: 'PaymentWallet' })
export class PaymentWalletDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty(PURPOSE_PROPERTY)
	purpose: PaymentWalletPurpose;

	@ApiProperty({
		type: String,
		description: 'EIP-55 checksummed address',
		example: ADDRESS_EXAMPLE,
	})
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
