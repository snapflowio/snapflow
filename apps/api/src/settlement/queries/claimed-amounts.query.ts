/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Hex } from 'viem';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { CLAIMED_EVENT } from '../constants/escrow.constants';
import type { EscrowIdentity } from '../types/escrow.types';
import type { VoucherAmounts } from '../types/payment-channel.types';

interface ClaimedRow {
	channelId: Hex;
	hostMicroUsd: string;
	feeMicroUsd: string;
	serviceMicroUsd: string;
}

// What the indexed Claimed events paid out of each channel, optionally only
// those confirmed in blocks before a given time.
export async function claimedAmounts(
	manager: EntityManager,
	escrow: EscrowIdentity,
	channelIds: readonly Hex[],
	before?: Date
): Promise<Map<Hex, VoucherAmounts>> {
	if (channelIds.length === 0) return new Map();
	const rows = await manager.execute<ClaimedRow[]>(
		`SELECT "args"->>'channelId' AS "channelId",
				SUM(("args"->>'hostPaid')::numeric) AS "hostMicroUsd",
				SUM(("args"->>'feePaid')::numeric) AS "feeMicroUsd",
				SUM(("args"->>'servicePaid')::numeric) AS "serviceMicroUsd"
		 FROM escrow_event
		 WHERE "chainId" = ? AND "contractAddress" = ? AND kind = ?
		   AND "args"->>'channelId' IN (?)
		   ${before === undefined ? '' : 'AND "blockTimestamp" < ?'}
		 GROUP BY 1`,
		[
			escrow.chainId,
			escrow.contractAddress,
			CLAIMED_EVENT,
			channelIds,
			...(before === undefined ? [] : [before]),
		]
	);
	return new Map(
		rows.map((row) => [
			row.channelId,
			{
				hostMicroUsd: MicroUsd.parse(row.hostMicroUsd),
				feeMicroUsd: MicroUsd.parse(row.feeMicroUsd),
				serviceMicroUsd: MicroUsd.parse(row.serviceMicroUsd),
			},
		])
	);
}
