/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Address } from 'viem';
import type { CreatePriceCardDto } from '../../marketplace/dto/price-card.dto';

export const DEVELOPMENT_MARKET_REFERENCE_PRICE = {
	bootstrapMedianMicroUsd: '40000',
} as const;

export const DEVELOPMENT_PRICE_CARD = {
	vcpuHourMicroUsd: '10000',
	memoryGibHourMicroUsd: '2500',
	gpuHourMicroUsd: '0',
	diskGibMonthMicroUsd: '100000',
	stoppedDiskGibMonthMicroUsd: '50000',
	egressMicroUsdPerGiB: '0',
} as const satisfies CreatePriceCardDto;

// Anvil's well-known test account #1: the local escrow pays the development
// host into a wallet whose key every Foundry install knows.
export const DEVELOPMENT_PAYOUT_WALLET_ADDRESS =
	'0x70997970C51812dc3A010C7d01b50e0d17dc79C8' satisfies Address;

export const DEVELOPMENT_TIER_REASON = 'development machine seed';
