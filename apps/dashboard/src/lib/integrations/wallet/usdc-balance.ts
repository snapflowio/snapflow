/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PublicSettlementConfig } from '@snapflow/api-client';
import { readUsdcBalanceOf } from '@snapflow/contracts/actions';
import { queryOptions, skipToken } from '@tanstack/svelte-query';
import { type Address, getAddress } from 'viem';
import { settlementWallets } from './wallet-config.ts';
import { walletCall } from './wallet-error.ts';

const USDC_BALANCE_QUERY_SCOPE = 'wallet-usdc-balance';

export const USDC_BALANCE_QUERY_KEY = [USDC_BALANCE_QUERY_SCOPE] as const;

export function usdcBalanceQueryOptions(
	settlement: PublicSettlementConfig,
	account: Address | null
) {
	return queryOptions({
		queryKey: [USDC_BALANCE_QUERY_SCOPE, settlement.chainId, account] as const,
		queryFn: account
			? () =>
					walletCall(() =>
						readUsdcBalanceOf(settlementWallets(settlement).config, {
							address: getAddress(settlement.usdcAddress),
							args: [account],
							chainId: settlement.chainId,
						})
					)
			: skipToken,
	});
}
