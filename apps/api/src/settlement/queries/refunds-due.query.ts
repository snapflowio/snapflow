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
import { MicroUsd } from '../../common/values/micro-usd.value';
import { parseDatabaseTimestamp } from '../../infra/database/utils/database-time.util';
import { PaymentChannelKind } from '../enums/payment-channel-kind.enum';
import type { EscrowIdentity } from '../types/escrow.types';

const DUE_SQL = `channel."chargedMicroUsd" - channel."refundedMicroUsd" - metered.amount`;

export async function refundsDue(
	manager: EntityManager,
	escrow: EscrowIdentity
) {
	const rows = await manager.execute<
		{
			id: string;
			customerOrganizationId: string;
			customerOrganizationName: string;
			customerAddress: Address;
			due: string;
			refunded: string;
			endedAt: string;
		}[]
	>(
		`SELECT channel.id,
				channel."customerOrganizationId",
				organization.name AS "customerOrganizationName",
				channel."customerAddress",
				${DUE_SQL} AS due,
				channel."refundedMicroUsd" AS refunded,
				metered."endedAt"
		 FROM "payment_channel" channel
		 INNER JOIN "organization" organization
			ON organization.id = channel."customerOrganizationId"
		 INNER JOIN (
			SELECT "paymentChannelId",
				   SUM("chargedMicroUsd") AS amount,
				   MAX("endedAt") AS "endedAt",
				   BOOL_AND("settledAt" IS NOT NULL) AS settled
			FROM "payment_channel_charge"
			GROUP BY "paymentChannelId"
		 ) metered ON metered."paymentChannelId" = channel.id
		 WHERE channel."chainId" = ?
		   AND channel."contractAddress" = ?
		   AND channel.kind = ?
		   AND metered.settled
		   AND ${DUE_SQL} > 0
		 ORDER BY metered."endedAt" ASC, channel.id ASC`,
		[escrow.chainId, escrow.contractAddress, PaymentChannelKind.SANDBOX]
	);
	return rows.map((row) => ({
		paymentChannelId: row.id,
		customerOrganizationId: row.customerOrganizationId,
		customerOrganizationName: row.customerOrganizationName,
		customerAddress: row.customerAddress,
		dueMicroUsd: MicroUsd.parse(row.due),
		refundedMicroUsd: MicroUsd.parse(row.refunded),
		endedAt: parseDatabaseTimestamp(row.endedAt),
	}));
}
