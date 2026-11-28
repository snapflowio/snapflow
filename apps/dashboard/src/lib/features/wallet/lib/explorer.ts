/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type SettlementChainId,
	settlementChain,
} from '#lib/integrations/wallet/wallet-networks.ts';

const TRANSACTION_PATH = 'tx';
const ADDRESS_PATH = 'address';
const NEW_TAB_TARGET = '_blank';
const NEW_TAB_FEATURES = 'noopener,noreferrer';

export function openExplorer(url: string): void {
	window.open(url, NEW_TAB_TARGET, NEW_TAB_FEATURES);
}

function explorerUrl(
	chainId: SettlementChainId,
	path: string,
	value: string
): string | null {
	const explorer = settlementChain(chainId).blockExplorers?.default.url;
	return explorer ? new URL(`${path}/${value}`, `${explorer}/`).href : null;
}

export function explorerTransactionUrl(
	chainId: SettlementChainId,
	hash: string
): string | null {
	return explorerUrl(chainId, TRANSACTION_PATH, hash);
}

export function explorerAddressUrl(
	chainId: SettlementChainId,
	address: string
): string | null {
	return explorerUrl(chainId, ADDRESS_PATH, address);
}

export function explorerName(chainId: SettlementChainId): string {
	return settlementChain(chainId).blockExplorers?.default.name ?? 'explorer';
}
