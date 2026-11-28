/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Hash } from 'viem';
import { AutoTopUp } from '../../entities/auto-top-up.entity';
import { HostSettlement } from '../../entities/host-settlement.entity';
import type { SettlementTransaction } from '../../entities/settlement-transaction.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';

export function normalizedTransactionHash(hash: Hash): Hash {
	return `0x${hash.slice(2).toLowerCase()}`;
}

export async function pointSettlementTransactionAt(
	manager: EntityManager,
	transaction: SettlementTransaction,
	transactionHash: Hash
): Promise<void> {
	await manager.nativeUpdate(
		AutoTopUp,
		{ lastTransactionHash: transaction.transactionHash },
		{ lastTransactionHash: transactionHash }
	);
	transaction.transactionHash = transactionHash;
	if (transaction.walletTransactionId) {
		await manager.nativeUpdate(
			WalletTransaction,
			{ id: transaction.walletTransactionId },
			{ transactionHash }
		);
	}
	if (transaction.hostSettlementId) {
		await manager.nativeUpdate(
			HostSettlement,
			{ id: transaction.hostSettlementId },
			{ transactionHash }
		);
	}
}
