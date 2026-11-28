/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';

export interface PlatformServiceCharges {
	organizationId: string;
	chargedMicroUsd: bigint;
}

export async function platformServiceCharges(
	manager: EntityManager
): Promise<PlatformServiceCharges[]> {
	const rows = await manager.execute<
		{ organizationId: string; charged: string }[]
	>(
		`SELECT charge."organizationId", SUM(charge."amountMicroUsd")::text AS charged
		 FROM storage_charge charge
		 WHERE EXISTS (
			SELECT 1 FROM payment_wallet wallet
			WHERE wallet."organizationId" = charge."organizationId"
			  AND wallet.purpose = ?
		 )
		 GROUP BY charge."organizationId"
		 HAVING SUM(charge."amountMicroUsd") > 0
		 ORDER BY charge."organizationId"`,
		[PaymentWalletPurpose.FUNDING]
	);
	return rows.map((row) => ({
		organizationId: row.organizationId,
		chargedMicroUsd: BigInt(row.charged),
	}));
}
