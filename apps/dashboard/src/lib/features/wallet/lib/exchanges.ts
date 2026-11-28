/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { base } from 'viem/chains';

interface ExchangeWithdrawal {
	name: string;
	fee: string;
}

export const BASE_USDC_EXCHANGES = [
	{ name: 'Coinbase', fee: 'Free' },
	{ name: 'Kraken', fee: 'Small fee' },
	{ name: 'OKX', fee: 'Small fee' },
	{ name: 'Binance', fee: 'Fee varies' },
	{ name: 'Robinhood', fee: 'Network fee only' },
] as const satisfies readonly ExchangeWithdrawal[];

export const EXCHANGES_WITHOUT_BASE = ['Revolut'] as const;

export function supportsExchangeWithdrawals(chainId: number): boolean {
	return chainId === base.id;
}
