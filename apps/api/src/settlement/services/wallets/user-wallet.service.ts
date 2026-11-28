/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { Passkey } from '../../../auth/entities/passkey.entity';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { UserWalletErrorCode } from '../../constants/user-wallet.constants';
import { UserWallet } from '../../entities/user-wallet.entity';
import { RecoveryStatus } from '../../enums/recovery-status.enum';
import { withSettlementChain } from '../../utils/chain-error.util';
import { storedPasskeyPublicKey } from '../../utils/wallets/passkey-public-key.util';
import {
	passkeyNotWalletCapable,
	walletNotFound,
} from '../../utils/wallets/wallet-error.util';
import {
	type PasskeySigner,
	storedSignerKey,
} from '../../utils/wallets/wallet-relay-call.util';
import { SafeWalletChainService } from './safe-wallet-chain.service';

@Injectable()
export class UserWalletService {
	private readonly logger = new Logger(UserWalletService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly chain: SafeWalletChainService,
		private readonly config: TypedConfigService
	) {}

	find(userId: string): Promise<UserWallet | null> {
		return this.entityManager.fork().findOne(UserWallet, { userId });
	}

	async findOrFail(userId: string): Promise<UserWallet> {
		const wallet = await this.find(userId);
		if (!wallet) throw walletNotFound();
		return wallet;
	}

	async create(userId: string, passkeyId?: string): Promise<UserWallet> {
		const manager = this.entityManager.fork();
		if (await manager.count(UserWallet, { userId })) {
			throw new ConflictException({
				code: UserWalletErrorCode.WALLET_EXISTS,
				message: 'You already have a wallet',
			});
		}
		const passkey = passkeyId
			? await this.passkeyOf(manager, userId, passkeyId)
			: await this.firstWalletPasskey(manager, userId);
		const signer = await this.signer(passkey);
		const { safeAddress, deployed } = await withSettlementChain(
			this.logger,
			async () => {
				const safe = await this.chain.safeAddress(signer.address);
				return { safeAddress: safe, deployed: await this.chain.deployed(safe) };
			}
		);
		const wallet = manager.create(UserWallet, {
			userId,
			passkeyId: passkey.id,
			chainId: this.config.get('settlement.chainId'),
			...storedSignerKey(signer),
			signerAddress: signer.address,
			safeAddress,
			deployedAt: deployed ? await databaseNow(manager) : null,
			recoveryStatus: RecoveryStatus.NONE,
			recoveryOwnerAddress: null,
			recoveryOwnerKind: null,
		});
		try {
			await manager.flush();
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;
			throw new ConflictException({
				code: UserWalletErrorCode.WALLET_EXISTS,
				message: 'You already have a wallet',
			});
		}
		return wallet;
	}

	async passkeySigner(
		userId: string,
		passkeyId: string
	): Promise<PasskeySigner> {
		const manager = this.entityManager.fork();
		return this.signer(await this.passkeyOf(manager, userId, passkeyId));
	}

	private async signer(passkey: Passkey): Promise<PasskeySigner> {
		const signer = await withSettlementChain(this.logger, () =>
			this.chain.passkeySigner(passkey)
		);
		if (!signer) throw passkeyNotWalletCapable();
		return signer;
	}

	private async passkeyOf(
		manager: EntityManager,
		userId: string,
		passkeyId: string
	): Promise<Passkey> {
		const passkey = await manager.findOne(Passkey, {
			id: passkeyId,
			user: userId,
		});
		if (!passkey) {
			throw new NotFoundException({
				code: UserWalletErrorCode.PASSKEY_NOT_FOUND,
				message: 'You have no passkey with this id',
			});
		}
		return passkey;
	}

	private async firstWalletPasskey(
		manager: EntityManager,
		userId: string
	): Promise<Passkey> {
		const passkeys = await manager.find(
			Passkey,
			{ user: userId },
			{ orderBy: { createdAt: QueryOrder.ASC } }
		);
		const passkey = passkeys.find(
			({ publicKey }) => storedPasskeyPublicKey(publicKey) !== null
		);
		if (!passkey) throw passkeyNotWalletCapable();
		return passkey;
	}
}
