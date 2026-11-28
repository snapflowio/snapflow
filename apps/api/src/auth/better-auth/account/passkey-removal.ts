/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { APIError } from 'better-auth/api';
import { type Address, isAddressEqual } from 'viem';
import { UserWallet } from '../../../settlement/entities/user-wallet.entity';
import { WalletTransaction } from '../../../settlement/entities/wallet-transaction.entity';
import { RecoveryOwnerKind } from '../../../settlement/enums/recovery-owner-kind.enum';
import type { SafeWalletChainService } from '../../../settlement/services/wallets/safe-wallet-chain.service';
import { isChainUnreachable } from '../../../settlement/utils/chain-error.util';
import { ownersStillSigning } from '../../../settlement/utils/wallets/wallet-recovery.util';
import { Passkey } from '../../entities/passkey.entity';

const PASSKEY_REMOVAL_ERROR = {
	OWNS_WALLET: 'PASSKEY_OWNS_WALLET',
	CHAIN_UNAVAILABLE: 'PASSKEY_WALLET_CHAIN_UNAVAILABLE',
} as const;

export interface PasskeyRemovalDependencies {
	orm: MikroORM;
	walletChain: SafeWalletChainService;
}

async function passkeyOwners(
	manager: EntityManager,
	wallet: UserWallet
): Promise<Address[]> {
	const recorded = await manager.find(
		WalletTransaction,
		{
			userWalletId: wallet.id,
			recoveryOwnerKind: RecoveryOwnerKind.PASSKEY,
		},
		{ fields: ['recoveryOwnerAddress'] }
	);
	return [
		wallet.signerAddress,
		...(wallet.recoveryOwnerKind === RecoveryOwnerKind.PASSKEY &&
		wallet.recoveryOwnerAddress
			? [wallet.recoveryOwnerAddress]
			: []),
		...recorded.flatMap(({ recoveryOwnerAddress }) =>
			recoveryOwnerAddress ? [recoveryOwnerAddress] : []
		),
	];
}

async function removalStrandsWallet(
	{ orm, walletChain }: PasskeyRemovalDependencies,
	userId: string,
	passkeyId: string
): Promise<boolean> {
	const manager = orm.em.fork();
	const wallet = await manager.findOne(UserWallet, { userId });
	if (!wallet) return false;
	const passkeys = await manager.find(Passkey, { user: userId });
	const removed = passkeys.find(({ id }) => id === passkeyId);
	if (!removed) return false;
	const removedSigner = await walletChain.passkeySigner(removed);
	if (!removedSigner) return false;
	const { owners } = await walletChain.state(
		wallet.safeAddress,
		wallet.signerAddress,
		wallet.signerAddress
	);
	if (!owners.some((owner) => isAddressEqual(owner, removedSigner.address))) {
		return false;
	}
	const liveSigners = await Promise.all(
		passkeys
			.filter(({ id }) => id !== passkeyId)
			.map((passkey) => walletChain.passkeySigner(passkey))
	);
	return (
		ownersStillSigning(
			owners,
			removedSigner.address,
			await passkeyOwners(manager, wallet),
			liveSigners.flatMap((signer) => (signer ? [signer.address] : []))
		).length === 0
	);
}

export async function assertPasskeyRemovable(
	dependencies: PasskeyRemovalDependencies,
	userId: string,
	passkeyId: unknown
): Promise<void> {
	if (typeof passkeyId !== 'string') return;
	let strands: boolean;
	try {
		strands = await removalStrandsWallet(dependencies, userId, passkeyId);
	} catch (error) {
		if (!isChainUnreachable(error)) throw error;
		throw APIError.from('SERVICE_UNAVAILABLE', {
			code: PASSKEY_REMOVAL_ERROR.CHAIN_UNAVAILABLE,
			message:
				"Your wallet's owners cannot be read right now; retry shortly before deleting this passkey",
		});
	}
	if (!strands) return;
	throw APIError.from('BAD_REQUEST', {
		code: PASSKEY_REMOVAL_ERROR.OWNS_WALLET,
		message:
			'This passkey is the last owner that can sign for your wallet; add another recovery owner before deleting it',
	});
}
