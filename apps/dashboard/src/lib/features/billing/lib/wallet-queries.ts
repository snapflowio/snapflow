/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { readUsdcBalanceOf } from '@snapflow/contracts/actions';
import { queryOptions, skipToken } from '@tanstack/svelte-query';
import type { EscrowWallet } from './escrow-wallet.ts';
import { walletCall } from './wallet-error.ts';

const USDC_BALANCE_QUERY_SCOPE = 'wallet-usdc-balance';

export const USDC_BALANCE_QUERY_KEY = [USDC_BALANCE_QUERY_SCOPE] as const;

export function usdcBalanceQueryOptions(wallet: EscrowWallet | null) {
	return queryOptions({
		queryKey: [
			USDC_BALANCE_QUERY_SCOPE,
			wallet?.chainId,
			wallet?.account,
		] as const,
		queryFn: wallet
			? () =>
					walletCall(() =>
						readUsdcBalanceOf(wallet.config, {
							address: wallet.usdc,
							args: [wallet.account],
							chainId: wallet.chainId,
						})
					)
			: skipToken,
	});
}
