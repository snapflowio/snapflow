/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PublicSettlementConfig } from '@snapflow/api-client';
import type { Chain } from 'viem';
import { base, baseSepolia, foundry } from 'viem/chains';

export type SettlementChainId = PublicSettlementConfig['chainId'];

const SETTLEMENT_CHAINS = {
	[base.id]: base,
	[baseSepolia.id]: baseSepolia,
	[foundry.id]: foundry,
} as const satisfies Record<SettlementChainId, Chain>;

export function settlementChain(chainId: SettlementChainId): Chain {
	return SETTLEMENT_CHAINS[chainId];
}
