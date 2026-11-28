/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { RecoveryOwner } from '@snapflow/api-client';
import { client } from '@snapflow/api-client/client.gen';
import {
	type PasskeySigner,
	type PreparedRecoveryOwner,
	type PreparedWalletCall,
	type SafeTarget,
	type SiweSigner,
	usdcTransfer,
	WalletService,
} from '@snapflow/sdk';
import { mutationOptions } from '@tanstack/svelte-query';
import type { Address } from 'viem';
import { USER_WALLET_QUERY_KEYS } from '#lib/api/settlement/user-wallet-queries.ts';
import { USDC_BALANCE_QUERY_KEY } from '#lib/integrations/wallet/usdc-balance.ts';
import {
	walletFailure,
	walletMutationFn,
} from '#lib/integrations/wallet/wallet-error.ts';

export interface WalletSigning {
	signer: PasskeySigner;
	target: SafeTarget;
}

interface UsdcSendRequest {
	target: SafeTarget;
	usdcAddress: Address;
	recipient: Address;
	amount: bigint;
}

interface PreparedSend {
	prepared: PreparedWalletCall;
	signer: PasskeySigner;
}

interface RecoveryOwnerRequest {
	owner: RecoveryOwner;
	target: SafeTarget;
}

interface PreparedRecoveryOwnerChange {
	prepared: PreparedRecoveryOwner;
	signer: PasskeySigner;
	ownerWallet?: SiweSigner;
}

const wallets = new WalletService(client);

export function prepareUsdcSendMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(
			({ usdcAddress, recipient, amount, target }: UsdcSendRequest) =>
				wallets.prepare([usdcTransfer(usdcAddress, recipient, amount)], {
					target,
				})
		),
		meta: { failure: walletFailure('The network fee could not be quoted') },
	});
}

export function sendUsdcMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(({ prepared, signer }: PreparedSend) =>
			wallets.executePrepared(prepared, signer)
		),
		meta: {
			success: 'USDC sent',
			failure: walletFailure('The transfer failed'),
			invalidates: [...USER_WALLET_QUERY_KEYS, USDC_BALANCE_QUERY_KEY],
		},
	});
}

export function prepareRecoveryOwnerMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(({ owner, target }: RecoveryOwnerRequest) =>
			wallets.prepareRecoveryOwner(owner, { target })
		),
		meta: { failure: walletFailure('The network fee could not be quoted') },
	});
}

export function addRecoveryOwnerMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(
			async ({
				prepared,
				signer,
				ownerWallet,
			}: PreparedRecoveryOwnerChange) => {
				const queued = await wallets.addPreparedRecoveryOwner(
					prepared,
					signer,
					ownerWallet
				);
				return wallets.waitForTransaction(queued.id);
			}
		),
		meta: {
			success: 'Recovery is active',
			failure: walletFailure('Recovery could not be set up'),
			invalidates: USER_WALLET_QUERY_KEYS,
		},
	});
}
