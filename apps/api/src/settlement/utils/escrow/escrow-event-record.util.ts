/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { MAXIMUM_DATE_MILLISECONDS } from '../../constants/escrow.constants';
import type { EscrowEvent } from '../../entities/escrow-event.entity';
import type { EscrowLog, StoredEscrowArgs } from '../../types/escrow.types';

type EscrowEventRecord = Pick<
	EscrowEvent,
	'kind' | 'args' | 'transactionHash' | 'logIndex' | 'blockNumber' | 'blockHash'
>;

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
		transactionHash: log.transactionHash,
		logIndex: log.logIndex,
		blockNumber: Number(log.blockNumber),
		blockHash: log.blockHash,
	};
}

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
