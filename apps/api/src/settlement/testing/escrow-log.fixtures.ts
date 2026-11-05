/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	type AbiEvent,
	type Address,
	encodeAbiParameters,
	encodeEventTopics,
	type Hash,
	keccak256,
	parseEventLogs,
	toHex,
} from 'viem';
import type { EscrowEventKind, EscrowLog } from '../types/escrow.types';

export const CUSTOMER_ADDRESS: Address =
	'0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
export const HOST_ADDRESS: Address =
	'0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
export const KEY_ADDRESS: Address =
	'0x90F79bf6Eb2c4f870365e785982E1f101e3B906B';
export const ESCROW_ADDRESS: Address =
	'0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
export const CHANNEL_ID: Hash = keccak256(toHex('channel'));

export interface LogPosition {
	blockNumber?: bigint;
	logIndex?: number;
	transactionHash?: Hash;
}

// Encodes the event like the contract would and decodes it back through the
// generated ABI, so tests see exactly what the indexer sees.
export function escrowLog(
	eventName: EscrowEventKind,
	args: Readonly<Record<string, unknown>>,
	position: LogPosition = {}
): EscrowLog {
	const item = snapflowEscrowAbi.find(
		(entry) => entry.type === 'event' && entry.name === eventName
	);
	if (item?.type !== 'event') throw new Error(`No ${eventName} event`);
	const event: AbiEvent = item;
	const values = event.inputs.filter((input) => !input.indexed);
	const [signature, ...indexed] = encodeEventTopics({
		abi: [event],
		args: { ...args },
	});
	const blockNumber = position.blockNumber ?? 1n;
	const [log] = parseEventLogs({
		abi: snapflowEscrowAbi,
		strict: true,
		logs: [
			{
				address: ESCROW_ADDRESS,
				blockHash: keccak256(toHex(`block ${blockNumber}`)),
				blockNumber,
				data: encodeAbiParameters(
					values,
					values.map((input) => args[input.name ?? ''])
				),
				logIndex: position.logIndex ?? 0,
				transactionHash:
					position.transactionHash ??
					keccak256(toHex(`transaction ${blockNumber}`)),
				transactionIndex: 0,
				removed: false,
				topics: [signature, ...indexed.flatMap((topic) => topic ?? [])],
			},
		],
	});
	if (!log) throw new Error(`Could not decode a ${eventName} log`);
	return log;
}
