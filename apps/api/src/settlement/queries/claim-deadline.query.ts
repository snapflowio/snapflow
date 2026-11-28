/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { parseDatabaseTimestamp } from '../../infra/database/utils/database-time.util';
import { PaymentChannelKind } from '../enums/payment-channel-kind.enum';
import type { EscrowIdentity } from '../types/escrow.types';
import type { HostSettlementItem } from '../types/host-settlement.types';

const CLAIM_DEADLINE = `LEAST(
	account."withdrawalUnlockAt",
	signer."expiresAt",
	signer."thawEndsAt"
)`;

const DEADLINE_JOINS = `LEFT JOIN escrow_account account
	ON account."chainId" = ? AND account."contractAddress" = ?
   AND account.address = channel."customerAddress"
 LEFT JOIN escrow_signer signer
	ON signer."chainId" = ? AND signer."contractAddress" = ?
   AND signer."signerAddress" = voucher."signerAddress"`;

function deadlineJoinParameters(escrow: EscrowIdentity): unknown[] {
	return [
		escrow.chainId,
		escrow.contractAddress,
		escrow.chainId,
		escrow.contractAddress,
	];
}

export async function earliestClaimDeadline(
	manager: EntityManager,
	escrow: EscrowIdentity,
	voucherIds: readonly string[]
): Promise<Date | null> {
	if (voucherIds.length === 0) return null;
	const [row] = await manager.execute<{ deadline: unknown }[]>(
		`SELECT min(${CLAIM_DEADLINE}) AS deadline
		 FROM payment_voucher voucher
		 JOIN payment_channel channel ON channel.id = voucher."paymentChannelId"
		 ${DEADLINE_JOINS}
		 WHERE voucher.id = ANY(ARRAY[?]::uuid[])`,
		[...deadlineJoinParameters(escrow), voucherIds]
	);
	return row?.deadline ? parseDatabaseTimestamp(row.deadline) : null;
}

export function hostClaimsDueBy(
	manager: EntityManager,
	escrow: EscrowIdentity,
	cutoff: Date
): Promise<HostSettlementItem[]> {
	return manager.execute<HostSettlementItem[]>(
		`SELECT channel.id AS "paymentChannelId",
				voucher.id AS "voucherId",
				(voucher."cumulativeMicroUsd" - channel."claimedMicroUsd")::text AS "maxAmountMicroUsd"
		 FROM (
			SELECT DISTINCT ON (latest."paymentChannelId") latest.*
			FROM payment_voucher latest
			JOIN payment_channel owner ON owner.id = latest."paymentChannelId"
			WHERE owner."chainId" = ? AND owner."contractAddress" = ?
			  AND owner.kind <> ?
			  AND owner."signedMicroUsd" > owner."claimedMicroUsd"
			  AND latest.signature IS NOT NULL
			ORDER BY latest."paymentChannelId", latest.sequence DESC
		 ) voucher
		 JOIN payment_channel channel ON channel.id = voucher."paymentChannelId"
		 ${DEADLINE_JOINS}
		 WHERE voucher."cumulativeMicroUsd" > channel."claimedMicroUsd"
		   AND ${CLAIM_DEADLINE} <= ?
		 ORDER BY ${CLAIM_DEADLINE}, channel.id`,
		[
			escrow.chainId,
			escrow.contractAddress,
			PaymentChannelKind.PLATFORM,
			...deadlineJoinParameters(escrow),
			cutoff,
		]
	);
}
