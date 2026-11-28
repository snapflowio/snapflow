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

export async function signerOutstanding(
	manager: EntityManager,
	escrow: EscrowIdentity,
	signerAddress: Address,
	exceptPaymentChannelId: string
): Promise<bigint> {
	const [row] = await manager.execute<{ outstanding: string }[]>(
		`SELECT COALESCE(SUM(GREATEST(signed.cumulative - channel."claimedMicroUsd", 0)), 0)::text AS outstanding
		 FROM (
			SELECT voucher."paymentChannelId", MAX(voucher."cumulativeMicroUsd") AS cumulative
			FROM payment_voucher voucher
			WHERE voucher."signerAddress" = ? AND voucher."paymentChannelId" <> ?
			GROUP BY 1
		 ) signed
		 INNER JOIN payment_channel channel ON channel.id = signed."paymentChannelId"
		 WHERE channel."chainId" = ? AND channel."contractAddress" = ?`,
		[
			signerAddress,
			exceptPaymentChannelId,
			escrow.chainId,
			escrow.contractAddress,
		]
	);
	return row ? BigInt(row.outstanding) : 0n;
}
