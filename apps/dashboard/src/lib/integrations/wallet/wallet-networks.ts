/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AppKitNetwork,
	base,
	baseSepolia,
	foundry,
} from '@reown/appkit/networks';
import type { PublicSettlementConfig } from '@snapflow/api-client';

export type SettlementChainId = PublicSettlementConfig['chainId'];

const SETTLEMENT_NETWORKS = {
	[base.id]: base,
	[baseSepolia.id]: baseSepolia,
	[foundry.id]: foundry,
} as const satisfies Record<SettlementChainId, AppKitNetwork>;

export type SettlementNetwork = (typeof SETTLEMENT_NETWORKS)[SettlementChainId];

export function settlementNetwork(
	chainId: SettlementChainId
): SettlementNetwork {
	return SETTLEMENT_NETWORKS[chainId];
}
