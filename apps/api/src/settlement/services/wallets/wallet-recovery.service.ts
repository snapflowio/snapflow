/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BadRequestException,
	ConflictException,
	Injectable,
} from '@nestjs/common';
import { addOwnerCall } from '@snapflow/contracts';
import { type Address, getAddress, isAddressEqual } from 'viem';
import type { TermsActor } from '../../../legal/utils/terms-acceptance.util';
import { UserWalletErrorCode } from '../../constants/user-wallet.constants';
import type {
	RecoveryOwnerDto,
	SubmitRecoveryOwnerDto,
} from '../../dto/user-wallet.dto';
import type { PreparedWalletTransactionDto } from '../../dto/wallet-transaction.dto';
import type { UserWallet } from '../../entities/user-wallet.entity';
import type { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { RecoveryOwnerKind } from '../../enums/recovery-owner-kind.enum';
import { RecoveryStatus } from '../../enums/recovery-status.enum';
import type { RecoveryOwner } from '../../utils/wallets/wallet-recovery.util';
import { SiweLinkService } from './siwe-link.service';
import { UserWalletService } from './user-wallet.service';
import { WalletTransactionService } from './wallet-transaction.service';

function invalidOwner(message: string): BadRequestException {
	return new BadRequestException({
		code: UserWalletErrorCode.RECOVERY_OWNER_INVALID,
		message,
	});
}

import { walletOwnerId } from '../../utils/wallets/user-wallet-owner.util';

@Injectable()
export class WalletRecoveryService {
	constructor(
		private readonly wallets: UserWalletService,
		private readonly transactions: WalletTransactionService,
		private readonly siwe: SiweLinkService
	) {}

	async prepare(
		wallet: UserWallet,
		input: RecoveryOwnerDto,
		actor: TermsActor
	): Promise<PreparedWalletTransactionDto> {
		const owner = await this.recoveryOwner(wallet, input);
		return this.transactions.prepare(
			wallet,
			addOwnerCall(wallet.safeAddress, owner.address),
			actor
		);
	}

	async submit(
		wallet: UserWallet,
		input: SubmitRecoveryOwnerDto,
		actor: TermsActor
	): Promise<WalletTransaction> {
		const owner = await this.recoveryOwner(wallet, input);
		if (owner.kind === RecoveryOwnerKind.WALLET) {
			await this.assertControlled(wallet, owner.address, input);
		}
		return this.transactions.submit(
			wallet,
			{
				call: this.transactions.feePaid(
					addOwnerCall(wallet.safeAddress, owner.address),
					BigInt(input.feeMicroUsd)
				),
				nonce: BigInt(input.nonce),
				signature: input.signature,
				signingPasskeyId: input.signingPasskeyId,
			},
			actor,
			owner
		);
	}

	private async assertControlled(
		wallet: UserWallet,
		owner: Address,
		input: SubmitRecoveryOwnerDto
	): Promise<void> {
		if (!input.ownerProof) {
			throw invalidOwner(
				'Sign the recovery owner message with the existing wallet first'
			);
		}
		const proven = await this.siwe.verifyRecoveryOwner(
			walletOwnerId(wallet),
			input.ownerProof
		);
		if (!isAddressEqual(proven, owner)) {
			throw invalidOwner(
				'The signed message proves control of a different wallet than the recovery owner'
			);
		}
	}

	private async recoveryOwner(
		wallet: UserWallet,
		input: RecoveryOwnerDto
	): Promise<RecoveryOwner> {
		if (wallet.recoveryStatus !== RecoveryStatus.NONE) {
			throw new ConflictException({
				code: UserWalletErrorCode.RECOVERY_OWNER_EXISTS,
				message: 'The wallet already has or is adding a recovery owner',
			});
		}
		const address = await this.ownerAddress(wallet, input);
		if (
			isAddressEqual(address, wallet.signerAddress) ||
			isAddressEqual(address, wallet.safeAddress)
		) {
			throw invalidOwner(
				'The recovery owner must differ from the wallet and its passkey'
			);
		}
		if (await this.transactions.controlledBySnapflow(address)) {
			throw invalidOwner(
				'Snapflow never recovers a wallet; choose a recovery owner only you control'
			);
		}
		return { address, kind: input.kind };
	}

	private async ownerAddress(
		wallet: UserWallet,
		input: RecoveryOwnerDto
	): Promise<Address> {
		if (input.kind === RecoveryOwnerKind.PASSKEY) {
			if (!input.passkeyId) throw invalidOwner('Name the recovery passkey');
			const signer = await this.wallets.passkeySigner(
				walletOwnerId(wallet),
				input.passkeyId
			);
			return signer.address;
		}
		if (!input.address) throw invalidOwner('Name the recovery owner address');
		return getAddress(input.address);
	}
}
