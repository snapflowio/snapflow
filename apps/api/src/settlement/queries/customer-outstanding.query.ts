/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Address } from 'viem';
import type { EscrowIdentity } from '../types/escrow.types';

export async function customerOutstanding(
	manager: EntityManager,
	escrow: EscrowIdentity,
	customerAddress: Address,
	exceptPaymentChannelId: string | null = null
): Promise<bigint> {
	const [row] = await manager.execute<{ outstanding: string }[]>(
		`SELECT COALESCE(SUM(GREATEST("issuedMicroUsd" - "claimedMicroUsd", 0)), 0)::text AS outstanding
		 FROM payment_channel
		 WHERE "chainId" = ? AND "contractAddress" = ? AND "customerAddress" = ?
		   AND id IS DISTINCT FROM ?`,
		[
			escrow.chainId,
			escrow.contractAddress,
			customerAddress,
			exceptPaymentChannelId,
		]
	);
	return row ? BigInt(row.outstanding) : 0n;
}
