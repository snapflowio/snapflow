/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { snapflowEscrowAbi } from '@snapflow/contracts';
import type {
	Address,
	ContractEventName,
	GetContractEventsReturnType,
} from 'viem';

type EscrowAbi = typeof snapflowEscrowAbi;

export type EscrowEventKind = ContractEventName<EscrowAbi>;

// A confirmed, fully decoded escrow log as getContractEvents returns it in
// strict mode over a block number range.
export type EscrowLog = GetContractEventsReturnType<
	EscrowAbi,
	undefined,
	true,
	bigint,
	bigint
>[number];

export type EscrowLogOf<Kind extends EscrowEventKind> = Extract<
	EscrowLog,
	{ eventName: Kind }
>;

// Decoded event arguments as stored: integers become decimal strings so
// uint256 amounts survive JSON.
export type StoredEscrowArgs = Readonly<Record<string, string>>;

export interface EscrowIdentity {
	chainId: number;
	contractAddress: Address;
}
