/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { base, baseSepolia, foundry } from 'viem/chains';

export const SETTLEMENT_CHAIN_ID = {
	BASE: base.id,
	BASE_SEPOLIA: baseSepolia.id,
	LOCAL: foundry.id,
} as const;

export type SettlementChainId =
	(typeof SETTLEMENT_CHAIN_ID)[keyof typeof SETTLEMENT_CHAIN_ID];

export const SETTLEMENT_CHAIN_IDS = Object.values(SETTLEMENT_CHAIN_ID);

export const DEFAULT_SANCTIONS_API_URL =
	'https://public.chainalysis.com/api/v1/address';
