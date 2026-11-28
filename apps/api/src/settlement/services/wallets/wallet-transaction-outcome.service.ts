/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import type { SettlementTransaction } from '../../entities/settlement-transaction.entity';
import { UserWallet } from '../../entities/user-wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { RecoveryStatus } from '../../enums/recovery-status.enum';
import { SettlementTransactionStatus } from '../../enums/settlement-transaction-status.enum';
import { WalletTransactionStatus } from '../../enums/wallet-transaction-status.enum';
import {
	type RecoveryOwner,
	recoveryFromOwners,
} from '../../utils/wallets/wallet-recovery.util';
import { SafeWalletChainService } from './safe-wallet-chain.service';

const WALLET_RELAY_DROPPED = 'dropped; relaying again';

const NO_FEE_PAID = '0';

@Injectable()
export class WalletTransactionOutcomeService {
	constructor(private readonly chain: SafeWalletChainService) {}

	async settle(
		manager: EntityManager,
		settlement: SettlementTransaction
	): Promise<void> {
		if (!settlement.walletTransactionId) return;
		const transaction = await manager.findOneOrFail(WalletTransaction, {
			id: settlement.walletTransactionId,
		});
		switch (settlement.status) {
			case SettlementTransactionStatus.SUCCEEDED:
				transaction.feePaidMicroUsd = transaction.feeMicroUsd;
				return this.conclude(manager, transaction, {
					status: WalletTransactionStatus.SUCCEEDED,
					error: null,
				});
			case SettlementTransactionStatus.DROPPED:
				manager.assign(transaction, {
					status: WalletTransactionStatus.QUEUED,
					transactionHash: null,
					error: WALLET_RELAY_DROPPED,
				});
				return;
			default:
				transaction.feePaidMicroUsd = NO_FEE_PAID;
				return this.conclude(manager, transaction, {
					status: WalletTransactionStatus.FAILED,
					error: settlement.status,
				});
		}
	}

	async fail(
		manager: EntityManager,
		walletTransactionId: string,
		reason: string
	): Promise<void> {
		const transaction = await manager.findOneOrFail(WalletTransaction, {
			id: walletTransactionId,
		});
		await this.conclude(manager, transaction, {
			status: WalletTransactionStatus.FAILED,
			error: reason,
		});
	}

	private async conclude(
		manager: EntityManager,
		transaction: WalletTransaction,
		outcome: Pick<WalletTransaction, 'status' | 'error'>
	): Promise<void> {
		const now = await databaseNow(manager);
		manager.assign(transaction, { ...outcome, settledAt: now });
		await this.refresh(manager, transaction, now);
	}

	private async refresh(
		manager: EntityManager,
		transaction: WalletTransaction,
		now: Date
	): Promise<void> {
		const wallet = await manager.findOneOrFail(
			UserWallet,
			{ id: transaction.userWalletId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		const state = await this.chain.state(
			wallet.safeAddress,
			wallet.signerAddress,
			wallet.signerAddress
		);
		if (state.safeDeployed && !wallet.deployedAt) wallet.deployedAt = now;
		const known: RecoveryOwner[] = [];
		if (transaction.recoveryOwnerAddress) {
			known.push({
				address: transaction.recoveryOwnerAddress,
				kind: transaction.recoveryOwnerKind,
			});
		}
		if (wallet.recoveryOwnerAddress) {
			known.push({
				address: wallet.recoveryOwnerAddress,
				kind: wallet.recoveryOwnerKind,
			});
		}
		const recovery = recoveryFromOwners(
			state.owners,
			wallet.signerAddress,
			known
		);
		const stillAdding =
			recovery.recoveryStatus === RecoveryStatus.NONE &&
			(await manager.count(WalletTransaction, {
				userWalletId: wallet.id,
				id: { $ne: transaction.id },
				recoveryOwnerAddress: { $ne: null },
				status: {
					$in: [WalletTransactionStatus.QUEUED, WalletTransactionStatus.SENT],
				},
			})) > 0;
		if (!stillAdding) manager.assign(wallet, recovery);
	}
}
