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
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import type { EscrowIdentity } from '../types/escrow.types';

export interface UnbilledServicePeriod {
	organizationId: string;
	periodStart: Date;
}

// The UTC months in which an organization owes platform fees but has no
// platform service channel in the escrow yet, for organizations with a
// funding wallet to pay them from. Months owed before a wallet was linked
// appear once it is.
export async function unbilledServicePeriods(
	manager: EntityManager,
	escrow: EscrowIdentity
): Promise<UnbilledServicePeriod[]> {
	const rows = await manager.execute<
		{ organizationId: string; periodStart: unknown }[]
	>(
		`SELECT period."organizationId", period."periodStart"
		 FROM (
			SELECT charge."organizationId",
				date_trunc('month', charge."serviceDay", 'UTC') AS "periodStart"
			FROM private_pool_charge charge
			WHERE charge."amountMicroUsd" > 0
			GROUP BY 1, 2
		 ) period
		 WHERE EXISTS (
			SELECT 1 FROM payment_wallet wallet
			WHERE wallet."organizationId" = period."organizationId"
			  AND wallet.purpose = ?
		 )
		 AND NOT EXISTS (
			SELECT 1 FROM payment_channel channel
			WHERE channel."chainId" = ? AND channel."contractAddress" = ?
			  AND channel."customerOrganizationId" = period."organizationId"
			  AND channel."servicePeriodStart" = period."periodStart"
		 )
		 ORDER BY period."periodStart", period."organizationId"`,
		[PaymentWalletPurpose.FUNDING, escrow.chainId, escrow.contractAddress]
	);
	return rows.map((row) => ({
		organizationId: row.organizationId,
		periodStart: parseDatabaseTimestamp(row.periodStart),
	}));
}
