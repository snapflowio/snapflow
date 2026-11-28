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

export const DEFAULT_LOG_BLOCK_RANGE = 1_000;
export const MAXIMUM_LOG_BLOCK_RANGE = 100_000;
export const DEFAULT_INDEXER_RANGES_PER_RUN = 20;
export const MAXIMUM_INDEXER_RANGES_PER_RUN = 1_000;

export const DEFAULT_SANCTIONS_LIST_URL =
	'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML';
