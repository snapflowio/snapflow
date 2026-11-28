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
import { Type } from 'class-transformer';
import {
	IsEnum,
	IsEthereumAddress,
	IsOptional,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import type { Address } from 'viem';
import { EVM_ADDRESS_API_PROPERTY } from '../constants/settlement.constants';
import type { UserWallet } from '../entities/user-wallet.entity';
import { RecoveryOwnerKind } from '../enums/recovery-owner-kind.enum';
import { RecoveryStatus } from '../enums/recovery-status.enum';
import { SiweProofDto } from './payment-wallet.dto';
import { WalletFeeDto, WalletSignatureDto } from './wallet-transaction.dto';

const RECOVERY_OWNER_KIND_PROPERTY = {
	enum: RecoveryOwnerKind,
	enumName: 'RecoveryOwnerKind',
	description:
		'phrase: the address of a BIP-39 phrase generated in the browser (the phrase never reaches Snapflow); passkey: the Safe signer of another of your passkeys; wallet: a wallet you already have',
} as const;

@ApiSchema({ name: 'CreateUserWallet' })
export class CreateUserWalletDto {
	@ApiPropertyOptional({
		format: 'uuid',
		description:
			'The P-256 passkey that will own the wallet; defaults to your first one',
	})
	@IsOptional()
	@IsUUID()
	passkeyId?: string;
}

@ApiSchema({ name: 'UserWallet' })
export class UserWalletDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ type: 'integer' })
	chainId: number;

	@ApiProperty({
		type: String,
		format: 'uuid',
		nullable: true,
		description:
			'The passkey whose signer owns the Safe; null once that passkey was deleted',
	})
	passkeyId: string | null;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description:
			"The passkey's Safe signer (SafeWebAuthnSignerFactory.getSigner), the Safe's owner",
	})
	signerAddress: Address;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description:
			'The Safe account; it receives funds before it is deployed, which happens with its first transaction',
	})
	safeAddress: Address;

	@ApiProperty()
	deployed: boolean;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	deployedAt: Date | null;

	@ApiProperty({
		enum: RecoveryStatus,
		enumName: 'RecoveryStatus',
		description:
			'Outgoing USDC transfers are refused until a recovery owner is active',
	})
	recoveryStatus: RecoveryStatus;

	@ApiProperty({ ...EVM_ADDRESS_API_PROPERTY, nullable: true })
	recoveryOwnerAddress: Address | null;

	@ApiProperty({ ...RECOVERY_OWNER_KIND_PROPERTY, nullable: true })
	recoveryOwnerKind: RecoveryOwnerKind | null;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: Date;

	static from(wallet: UserWallet): UserWalletDto {
		return {
			id: wallet.id,
			chainId: wallet.chainId,
			passkeyId: wallet.passkeyId,
			signerAddress: wallet.signerAddress,
			safeAddress: wallet.safeAddress,
			deployed: wallet.deployedAt !== null,
			deployedAt: wallet.deployedAt,
			recoveryStatus: wallet.recoveryStatus,
			recoveryOwnerAddress: wallet.recoveryOwnerAddress,
			recoveryOwnerKind: wallet.recoveryOwnerKind,
			createdAt: wallet.createdAt,
		};
	}
}

@ApiSchema({ name: 'RecoveryOwner' })
export class RecoveryOwnerDto {
	@ApiProperty(RECOVERY_OWNER_KIND_PROPERTY)
	@IsEnum(RecoveryOwnerKind)
	kind: RecoveryOwnerKind;

	@ApiPropertyOptional({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The owner address, for the phrase and wallet kinds',
	})
	@ValidateIf(
		({ kind }: RecoveryOwnerDto) => kind !== RecoveryOwnerKind.PASSKEY
	)
	@IsEthereumAddress()
	address?: Address;

	@ApiPropertyOptional({
		format: 'uuid',
		description:
			'Your other P-256 passkey whose Safe signer becomes the owner, for the passkey kind',
	})
	@ValidateIf(
		({ kind }: RecoveryOwnerDto) => kind === RecoveryOwnerKind.PASSKEY
	)
	@IsUUID()
	passkeyId?: string;
}

@ApiSchema({ name: 'SubmitRecoveryOwner' })
export class SubmitRecoveryOwnerDto extends IntersectionType(
	RecoveryOwnerDto,
	WalletSignatureDto,
	WalletFeeDto
) {
	@ApiPropertyOptional({
		type: SiweProofDto,
		description:
			'For the wallet kind: the existing wallet signs a Sign-In With Ethereum message built from POST /user-wallet/recovery-owner/siwe-nonce, proving you control it',
	})
	@ValidateIf(
		({ kind }: SubmitRecoveryOwnerDto) => kind === RecoveryOwnerKind.WALLET
	)
	@ValidateNested()
	@Type(() => SiweProofDto)
	ownerProof?: SiweProofDto;
}
