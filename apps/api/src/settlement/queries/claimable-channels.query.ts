/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { PaymentChannel } from '../entities/payment-channel.entity';
import type { EscrowIdentity } from '../types/escrow.types';

// Channels with no claim in flight whose signed vouchers go beyond the last
// sequence seen claimed and can still be claimed.
export async function claimableChannels(
	manager: EntityManager,
	escrow: EscrowIdentity,
	now: Date
): Promise<PaymentChannel[]> {
	const rows = await manager.execute<{ id: string }[]>(
		`SELECT channel.id
		 FROM payment_channel channel
		 WHERE channel."chainId" = ? AND channel."contractAddress" = ?
		   AND channel."claimTransactionHash" IS NULL
		   AND EXISTS (
				SELECT 1 FROM payment_voucher voucher
				WHERE voucher."paymentChannelId" = channel.id
				  AND voucher.signature IS NOT NULL
				  AND voucher.sequence > channel."claimedSequence"
				  AND voucher."claimableUntil" > ?
		   )`,
		[escrow.chainId, escrow.contractAddress, now]
	);
	if (rows.length === 0) return [];
	return manager.find(PaymentChannel, {
		id: { $in: rows.map(({ id }) => id) },
	});
}
