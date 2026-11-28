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
import { SanctionsStatus } from '../enums/sanctions-status.enum';
import type { ScreenedPaymentWallet } from '../types/sanctions.types';

const SCREENED_WALLET_COLUMNS = `wallet.id, wallet."organizationId", wallet.purpose, wallet.address`;

const LISTED_SQL = `EXISTS (
	SELECT 1 FROM "sanctioned_address" listed
	WHERE listed.address = lower(wallet.address)
)`;

export function rescreenPaymentWallets(
	manager: EntityManager
): Promise<ScreenedPaymentWallet[]> {
	return manager.execute<ScreenedPaymentWallet[]>(
		`WITH screened AS (
			UPDATE "payment_wallet" wallet
			SET "sanctionsStatus" = CASE WHEN ${LISTED_SQL} THEN ? ELSE ? END,
				"sanctionsCheckedAt" = transaction_timestamp()
			WHERE wallet."sanctionsStatus" <> ?
			RETURNING ${SCREENED_WALLET_COLUMNS}, wallet."sanctionsStatus"
		)
		SELECT id, "organizationId", purpose, address
		FROM screened
		WHERE "sanctionsStatus" = ?
		ORDER BY "organizationId", purpose`,
		[
			SanctionsStatus.BLOCKED,
			SanctionsStatus.CLEAR,
			SanctionsStatus.BLOCKED,
			SanctionsStatus.BLOCKED,
		]
	);
}

export async function blockedPaymentWallets(
	manager: EntityManager,
	addresses: readonly Address[]
): Promise<ScreenedPaymentWallet[]> {
	if (addresses.length === 0) return [];
	return manager.execute<ScreenedPaymentWallet[]>(
		`SELECT ${SCREENED_WALLET_COLUMNS}
		FROM "payment_wallet" wallet
		WHERE wallet."sanctionsStatus" = ?
		  AND lower(wallet.address) = ANY(ARRAY[?]::varchar[])
		ORDER BY wallet."organizationId", wallet.purpose`,
		[SanctionsStatus.BLOCKED, addresses]
	);
}
