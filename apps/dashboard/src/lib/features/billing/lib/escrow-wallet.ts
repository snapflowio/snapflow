/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Config, waitForTransactionReceipt } from '@wagmi/core';
import type { Address, Hash } from 'viem';
import { walletCall } from './wallet-error.ts';

export interface EscrowWallet {
	config: Config;
	chainId: number;
	account: Address;
	escrow: Address;
	usdc: Address;
}

export function confirmTransaction(
	wallet: EscrowWallet,
	send: () => Promise<Hash>
): Promise<Hash> {
	return walletCall(async () => {
		const hash = await send();
		await waitForTransactionReceipt(wallet.config, {
			hash,
			chainId: wallet.chainId,
		});
		return hash;
	});
}
