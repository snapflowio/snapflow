/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { MAXIMUM_DATE_MILLISECONDS } from '../constants/escrow.constants';
import type { EscrowEvent } from '../entities/escrow-event.entity';
import type { EscrowLog, StoredEscrowArgs } from '../types/escrow.types';

export type EscrowEventRecord = Pick<
	EscrowEvent,
	| 'kind'
	| 'args'
	| 'customerAddress'
	| 'hostAddress'
	| 'transactionHash'
	| 'logIndex'
	| 'blockNumber'
	| 'blockHash'
>;

type EscrowParties = Pick<EscrowEvent, 'customerAddress' | 'hostAddress'>;

const NO_PARTIES: EscrowParties = { customerAddress: null, hostAddress: null };

// The customer is whoever's escrow balance or keys an event touches and the
// host whoever a claim paid. A blocked address can be either, so a block
// concerns both the funding and the payout wallet of that address.
function escrowParties(log: EscrowLog): EscrowParties {
	switch (log.eventName) {
		case 'Deposited':
		case 'SessionKeySet':
		case 'SessionKeyRevoked':
		case 'WithdrawalRequested':
		case 'WithdrawalCancelled':
		case 'Withdrawn':
			return { customerAddress: log.args.customer, hostAddress: null };
		case 'Claimed':
			return {
				customerAddress: log.args.customer,
				hostAddress: log.args.host,
			};
		case 'AddressBlocked':
		case 'AddressUnblocked':
			return {
				customerAddress: log.args.account,
				hostAddress: log.args.account,
			};
		default:
			return NO_PARTIES;
	}
}

function storedEscrowArgs(args: EscrowLog['args']): StoredEscrowArgs {
	return Object.fromEntries(
		Object.entries(args).map(([name, value]: [string, unknown]) => [
			name,
			String(value),
		])
	);
}

export function escrowEventRecord(log: EscrowLog): EscrowEventRecord {
	return {
		kind: log.eventName,
		args: storedEscrowArgs(log.args),
		...escrowParties(log),
		transactionHash: log.transactionHash,
		logIndex: log.logIndex,
		blockNumber: Number(log.blockNumber),
		blockHash: log.blockHash,
	};
}

// Ledger source reference of an event: unique per log on a chain.
export function escrowSourceReference(
	event: Pick<EscrowEvent, 'chainId' | 'transactionHash' | 'logIndex'>
): string {
	return `${event.chainId}:${event.transactionHash}:${event.logIndex}`;
}

export function chainTimestamp(seconds: bigint): Date {
	const milliseconds = seconds * BigInt(MILLISECONDS_PER_SECOND);
	return new Date(
		milliseconds > BigInt(MAXIMUM_DATE_MILLISECONDS)
			? MAXIMUM_DATE_MILLISECONDS
			: Number(milliseconds)
	);
}
