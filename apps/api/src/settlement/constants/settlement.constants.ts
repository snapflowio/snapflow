/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MAX_FEE_BPS } from '@snapflow/contracts';
import type { Chain } from 'viem';
import { base, baseSepolia, foundry } from 'viem/chains';
import {
	MILLISECONDS_PER_SECOND,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import {
	SETTLEMENT_CHAIN_ID,
	type SettlementChainId,
} from '../../config/constants/settlement-chain.constants';
import type { PermissionPair } from '../../organization/utils/organization-permissions.util';
import { SettlementParty } from '../enums/settlement-party.enum';
import { maximumMarkupForFee } from '../utils/fees/markup-fee.util';

export const SETTLEMENT_PUBLIC_CLIENT = Symbol('SETTLEMENT_PUBLIC_CLIENT');
export const SETTLEMENT_RELAYER_WALLET = Symbol('SETTLEMENT_RELAYER_WALLET');

export const SETTLEMENT_CHAINS: Readonly<Record<SettlementChainId, Chain>> = {
	[SETTLEMENT_CHAIN_ID.BASE]: base,
	[SETTLEMENT_CHAIN_ID.BASE_SEPOLIA]: baseSepolia,
	[SETTLEMENT_CHAIN_ID.LOCAL]: foundry,
};

export const SETTLEMENT_RPC_TIMEOUT_MILLISECONDS = 10 * MILLISECONDS_PER_SECOND;

export const CHAIN_IDENTITY_RETRY_BACKOFF = {
	baseMilliseconds: MILLISECONDS_PER_SECOND,
	capMilliseconds: SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND,
} as const;

export const RELAYER_FEE_BUMP = {
	REPLACE_AFTER_SECONDS: 2 * SECONDS_PER_MINUTE,
	NUMERATOR: 1_125n,
	DENOMINATOR: 1_000n,
	MINIMUM_INCREMENT: 1n,
	MAXIMUM_MULTIPLIER: 4n,
} as const;

export const CHAIN_CLOCK_REFRESH_MILLISECONDS = 5 * MILLISECONDS_PER_SECOND;

export const MAXIMUM_MARKUP_BASIS_POINTS = maximumMarkupForFee(MAX_FEE_BPS);

export const EVM_ADDRESS_LENGTH = 42;
export const EVM_HASH_LENGTH = 66;
export const EVM_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export const EVM_ADDRESS_API_PROPERTY = {
	type: String,
	description: 'EIP-55 checksummed address',
} as const;

export const UINT_STRING_API_PROPERTY = {
	type: String,
	pattern: '^\\d+$',
} as const;

export const SETTLEMENT_PARTY_READ_PERMISSION: Readonly<
	Record<SettlementParty, PermissionPair>
> = {
	[SettlementParty.CUSTOMER]: { resource: 'billing', action: 'read' },
	[SettlementParty.HOST]: { resource: 'payouts', action: 'read' },
};

export const SETTLEMENT_PARTIES = Object.values(SettlementParty);
