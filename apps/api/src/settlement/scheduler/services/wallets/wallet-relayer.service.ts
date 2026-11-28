/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { isSafeOperation, relayedSafeTransaction } from '@snapflow/contracts';
import { WALLET_RELAYER } from '../../../constants/user-wallet.constants';
import { UserWallet } from '../../../entities/user-wallet.entity';
import { WalletTransaction } from '../../../entities/wallet-transaction.entity';
import { SettlementTransactionKind } from '../../../enums/settlement-transaction-kind.enum';
import { WalletTransactionStatus } from '../../../enums/wallet-transaction-status.enum';
import { SafeWalletChainService } from '../../../services/wallets/safe-wallet-chain.service';
import { WalletFeeService } from '../../../services/wallets/wallet-fee.service';
import { WalletTransactionService } from '../../../services/wallets/wallet-transaction.service';
import { WalletTransactionOutcomeService } from '../../../services/wallets/wallet-transaction-outcome.service';
import {
	failQueued,
	relayOnePerKey,
} from '../../../utils/operator/operator-queue.util';
import { transactionSigner } from '../../../utils/wallets/wallet-relay-call.util';
import { OperatorTransactionService } from '../operator/operator-transaction.service';

@Injectable()
export class WalletRelayerService {
	private readonly logger = new Logger(WalletRelayerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly chain: SafeWalletChainService,
		private readonly transactions: WalletTransactionService,
		private readonly fees: WalletFeeService,
		private readonly operatorTransactions: OperatorTransactionService,
		private readonly outcomes: WalletTransactionOutcomeService
	) {}

	async relayQueued(): Promise<void> {
		const manager = this.entityManager.fork();
		const inFlight = await manager.find(
			WalletTransaction,
			{ status: WalletTransactionStatus.SENT },
			{ fields: ['userWalletId'] }
		);
		const queued = await manager.find(
			WalletTransaction,
			{ status: WalletTransactionStatus.QUEUED },
			{
				orderBy: { safeNonce: QueryOrder.ASC, createdAt: QueryOrder.ASC },
				limit: WALLET_RELAYER.BATCH_SIZE,
			}
		);
		await relayOnePerKey(
			queued,
			inFlight.map(({ userWalletId }) => userWalletId),
			({ userWalletId }) => userWalletId,
			this.logger,
			{
				relay: ({ id }) => this.relay(id),
				fail: (transaction, reason) => this.fail(transaction, reason),
			}
		);
	}

	private async relay(walletTransactionId: string): Promise<void> {
		const manager = this.entityManager.fork();
		const transaction = await manager.findOneOrFail(WalletTransaction, {
			id: walletTransactionId,
		});
		const wallet = await manager.findOneOrFail(UserWallet, {
			id: transaction.userWalletId,
		});
		const { operation } = transaction;
		if (!isSafeOperation(operation)) {
			return this.fail(transaction, 'unknown Safe operation');
		}
		const signer = transactionSigner(transaction);
		const state = await this.chain.state(
			wallet.safeAddress,
			wallet.signerAddress,
			signer.address
		);
		const call = {
			to: transaction.to,
			value: 0n,
			data: transaction.data,
			operation,
		};
		const refusal = await this.transactions.refusal(wallet, call, state.owners);
		if (refusal) return this.fail(transaction, refusal.message);
		const nonce = BigInt(transaction.safeNonce);
		if (nonce !== state.nonce) {
			return this.fail(
				transaction,
				`the Safe is at nonce ${state.nonce}, not ${nonce}`
			);
		}
		const relay = this.transactions.relayCall(
			wallet,
			signer,
			relayedSafeTransaction(call, nonce),
			transaction.signatures,
			state
		);
		const repayment = await this.fees.repayment(wallet, call, relay);
		if (repayment.refusal) {
			return this.fail(transaction, repayment.refusal.message);
		}
		await this.operatorTransactions.send(
			SettlementTransactionKind.WALLET_TRANSACTION,
			{ ...relay, gas: repayment.gasLimit },
			{ walletTransactionId: transaction.id },
			async (manager, hash) => {
				const current = await manager.findOneOrFail(WalletTransaction, {
					id: transaction.id,
				});
				manager.assign(current, {
					status: WalletTransactionStatus.SENT,
					transactionHash: hash,
					error: null,
				});
			}
		);
	}

	private fail(
		transaction: Pick<WalletTransaction, 'id'>,
		reason: string
	): Promise<void> {
		return failQueued(this.entityManager, this.logger, this.outcomes, {
			id: transaction.id,
			description: `Wallet transaction ${transaction.id}`,
			reason,
		});
	}
}
