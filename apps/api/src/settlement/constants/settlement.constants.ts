/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Chain } from 'viem';
import { base, baseSepolia, foundry } from 'viem/chains';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import {
	SETTLEMENT_CHAIN_ID,
	type SettlementChainId,
} from '../../config/constants/settlement-chain.constants';
import type { PermissionPair } from '../../organization/utils/organization-permissions.util';
import { SettlementParty } from '../enums/settlement-party.enum';

export const SETTLEMENT_PUBLIC_CLIENT = Symbol('SETTLEMENT_PUBLIC_CLIENT');
export const SETTLEMENT_VOUCHER_SIGNER = Symbol('SETTLEMENT_VOUCHER_SIGNER');
export const SETTLEMENT_RELAYER_WALLET = Symbol('SETTLEMENT_RELAYER_WALLET');

export const SETTLEMENT_CHAINS: Readonly<Record<SettlementChainId, Chain>> = {
	[SETTLEMENT_CHAIN_ID.BASE]: base,
	[SETTLEMENT_CHAIN_ID.BASE_SEPOLIA]: baseSepolia,
	[SETTLEMENT_CHAIN_ID.LOCAL]: foundry,
};

export const SETTLEMENT_RPC_TIMEOUT_MILLISECONDS = 10 * MILLISECONDS_PER_SECOND;

// EscrowLimits.MAX_FEE_BPS: the escrow never accepts a fee above 30% of the
// host's amount, whatever fee cap its admin schedules.
export const ESCROW_MAXIMUM_FEE_BASIS_POINTS = 3_000;

export const EVM_ADDRESS_LENGTH = 42;
export const EVM_HASH_LENGTH = 66;

export const EVM_ADDRESS_API_PROPERTY = {
	type: String,
	description: 'EIP-55 checksummed address',
} as const;

export const UINT_STRING_API_PROPERTY = {
	type: String,
	pattern: '^\\d+$',
} as const;

// The customer side of the escrow is billing data and the host side payout
// data.
export const SETTLEMENT_PARTY_READ_PERMISSION: Readonly<
	Record<SettlementParty, PermissionPair>
> = {
	[SettlementParty.CUSTOMER]: { resource: 'billing', action: 'read' },
	[SettlementParty.HOST]: { resource: 'payouts', action: 'read' },
};

export const SETTLEMENT_PARTIES = Object.values(SettlementParty);

export const SANCTIONS_API_KEY_HEADER = 'X-API-Key';
export const SANCTIONS_REQUEST_TIMEOUT_MILLISECONDS =
	10 * MILLISECONDS_PER_SECOND;
