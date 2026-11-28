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
	ContractFunctionArgs,
	GetContractEventsReturnType,
	Hex,
} from 'viem';
import type { EscrowBucket } from '../enums/escrow-bucket.enum';

type EscrowAbi = typeof snapflowEscrowAbi;

export type EscrowEventKind = ContractEventName<EscrowAbi>;

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

export type EscrowClaimItem = ContractFunctionArgs<
	EscrowAbi,
	'nonpayable',
	'claimBatch'
>[0][number];

export type StoredEscrowArgs = Readonly<Record<string, string>>;

export interface EscrowIdentity {
	chainId: number;
	contractAddress: Address;
}

export interface EscrowMovement {
	from: EscrowBucket;
	to: EscrowBucket;
	amount: string;
}

export interface ProjectedEscrowEvent {
	customerAddress: Address | null;
	hostAddress: Address | null;
	channelId: Hex | null;
	movements: EscrowMovement[];
}
