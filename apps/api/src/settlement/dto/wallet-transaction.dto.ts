/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiProperty,
	ApiPropertyOptional,
	ApiSchema,
	IntersectionType,
} from '@nestjs/swagger';
import {
	SAFE_OPERATIONS,
	type SafeOperation,
	type SafeTransaction,
	type WalletFeePayee,
} from '@snapflow/contracts';
import {
	IsEthereumAddress,
	IsIn,
	IsOptional,
	IsUUID,
	Matches,
	MaxLength,
} from 'class-validator';
import type { Address, Hash, Hex } from 'viem';
import {
	EVM_ADDRESS_API_PROPERTY,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import {
	HEX_DATA_PATTERN,
	WALLET_TRANSACTION_LIMITS,
} from '../constants/user-wallet.constants';
import type { WalletTransaction } from '../entities/wallet-transaction.entity';
import { RecoveryOwnerKind } from '../enums/recovery-owner-kind.enum';
import { WalletTransactionStatus } from '../enums/wallet-transaction-status.enum';

const UINT_PATTERN = new RegExp(UINT_STRING_API_PROPERTY.pattern);

const OPERATION_PROPERTY = {
	type: 'integer',
	enum: SAFE_OPERATIONS,
	description:
		'0: call; 1: delegate call, accepted only into MultiSendCallOnly v1.4.1',
} as const;

const DATA_PROPERTY = {
	type: String,
	pattern: HEX_DATA_PATTERN.source,
	maxLength: WALLET_TRANSACTION_LIMITS.DATA_MAX_LENGTH,
} as const;

const FEE_PROPERTY = {
	...UINT_STRING_API_PROPERTY,
	maxLength: WALLET_TRANSACTION_LIMITS.FEE_MAX_DIGITS,
} as const;

const SIGNING_PASSKEY_PROPERTY = {
	format: 'uuid',
	description:
		'The passkey that signed; defaults to the passkey the wallet was created with. Its signer must own the Safe',
} as const;

@ApiSchema({ name: 'WalletCall' })
export class WalletCallDto {
	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	@IsEthereumAddress()
	to: Address;

	@ApiProperty(DATA_PROPERTY)
	@Matches(HEX_DATA_PATTERN)
	@MaxLength(WALLET_TRANSACTION_LIMITS.DATA_MAX_LENGTH)
	data: Hex;

	@ApiProperty(OPERATION_PROPERTY)
	@IsIn(SAFE_OPERATIONS)
	operation: SafeOperation;
}

@ApiSchema({ name: 'WalletSignature' })
export class WalletSignatureDto {
	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'The Safe nonce the transaction was prepared with',
	})
	@Matches(UINT_PATTERN)
	nonce: string;

	@ApiProperty({
		type: String,
		pattern: HEX_DATA_PATTERN.source,
		maxLength: WALLET_TRANSACTION_LIMITS.SIGNATURE_MAX_LENGTH,
		description:
			"The passkey's WebAuthn assertion over the safeTxHash challenge, ABI-encoded as (bytes authenticatorData, bytes clientDataFields, uint256[2] rs): what Safe's passkey signer verifies and protocol-kit's passkey signer produces",
	})
	@Matches(HEX_DATA_PATTERN)
	@MaxLength(WALLET_TRANSACTION_LIMITS.SIGNATURE_MAX_LENGTH)
	signature: Hex;

	@ApiPropertyOptional(SIGNING_PASSKEY_PROPERTY)
	@IsOptional()
	@IsUUID()
	signingPasskeyId?: string;
}

@ApiSchema({ name: 'WalletFee' })
export class WalletFeeDto {
	@ApiProperty({
		...FEE_PROPERTY,
		description:
			"The USDC fee, in base units, the transaction was prepared and signed with; it ends the batch as a transfer to Snapflow's relayer",
	})
	@Matches(UINT_PATTERN)
	@MaxLength(WALLET_TRANSACTION_LIMITS.FEE_MAX_DIGITS)
	feeMicroUsd: string;
}

@ApiSchema({ name: 'SubmitWalletTransaction' })
export class SubmitWalletTransactionDto extends IntersectionType(
	WalletCallDto,
	WalletSignatureDto
) {}

@ApiSchema({ name: 'PreparedWalletTransaction' })
export class PreparedWalletTransactionDto {
	@ApiProperty({ type: 'integer' })
	chainId: number;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The Safe, the EIP-712 verifying contract',
	})
	safeAddress: Address;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'MultiSendCallOnly v1.4.1',
	})
	to: Address;

	@ApiProperty(UINT_STRING_API_PROPERTY)
	value: string;

	@ApiProperty({
		...DATA_PROPERTY,
		description:
			'multiSend calldata: the call, or the calls of its batch, then the fee transfer',
	})
	data: Hex;

	@ApiProperty(OPERATION_PROPERTY)
	operation: SafeOperation;

	@ApiProperty(UINT_STRING_API_PROPERTY)
	nonce: string;

	@ApiProperty({
		type: String,
		description:
			"Safe.getTransactionHash of the transaction with zero refund fields; its 32 bytes are the passkey's WebAuthn challenge",
	})
	safeTxHash: Hash;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'The USDC fee, in base units, the batch pays the relayer: the estimated gas of the relayed transaction at the live gas price (L1 data fee included) and ETH price, plus the margin setting. The wallet must hold it on top of the USDC the call moves',
	})
	feeMicroUsd: string;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The token the fee is paid in: USDC',
	})
	feeToken: Address;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: "Snapflow's relayer, which the fee transfer pays",
	})
	feeRecipient: Address;

	static from(
		chainId: number,
		safeAddress: Address,
		transaction: SafeTransaction,
		safeTxHash: Hash,
		fee: { feeMicroUsd: bigint; payee: WalletFeePayee }
	): PreparedWalletTransactionDto {
		return {
			chainId,
			safeAddress,
			to: transaction.to,
			value: transaction.value.toString(),
			data: transaction.data,
			operation: transaction.operation as SafeOperation,
			nonce: transaction.nonce.toString(),
			safeTxHash,
			feeMicroUsd: fee.feeMicroUsd.toString(),
			feeToken: fee.payee.usdc,
			feeRecipient: fee.payee.relayer,
		};
	}
}

@ApiSchema({ name: 'WalletTransaction' })
export class WalletTransactionDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ type: String })
	safeTxHash: Hash;

	@ApiProperty(UINT_STRING_API_PROPERTY)
	nonce: string;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	to: Address;

	@ApiProperty(DATA_PROPERTY)
	data: Hex;

	@ApiProperty(OPERATION_PROPERTY)
	operation: number;

	@ApiProperty({
		enum: WalletTransactionStatus,
		enumName: 'WalletTransactionStatus',
	})
	status: WalletTransactionStatus;

	@ApiProperty({
		type: String,
		nullable: true,
		description: 'The operator transaction that carried it, once sent',
	})
	transactionHash: Hash | null;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'The signed USDC fee, base units, the transaction pays the relayer if it succeeds',
	})
	feeMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		nullable: true,
		description:
			'The USDC fee, base units, the wallet paid the relayer: the signed fee once the transaction succeeded, zero when it reverted, null until then',
	})
	feePaidMicroUsd: string | null;

	@ApiProperty({ type: String, nullable: true })
	error: string | null;

	@ApiProperty({
		enum: RecoveryOwnerKind,
		enumName: 'RecoveryOwnerKind',
		nullable: true,
		description: 'Set when the transaction adds the recovery owner',
	})
	recoveryOwnerKind: RecoveryOwnerKind | null;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: Date;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	settledAt: Date | null;

	static from(transaction: WalletTransaction): WalletTransactionDto {
		return {
			id: transaction.id,
			safeTxHash: transaction.safeTxHash,
			nonce: transaction.safeNonce,
			to: transaction.to,
			data: transaction.data,
			operation: transaction.operation,
			status: transaction.status,
			transactionHash: transaction.transactionHash,
			feeMicroUsd: transaction.feeMicroUsd,
			feePaidMicroUsd: transaction.feePaidMicroUsd,
			error: transaction.error,
			recoveryOwnerKind: transaction.recoveryOwnerKind,
			createdAt: transaction.createdAt,
			settledAt: transaction.settledAt,
		};
	}
}
