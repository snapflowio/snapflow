/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	type Hash,
	type Hex,
	keccak256,
	type PublicClient,
	parseEventLogs,
	TransactionNotFoundError,
	type TransactionReceipt,
	TransactionReceiptNotFoundError,
} from 'viem';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import {
	CLAIM_FAILURE_OTHER,
	CLAIM_FAILURE_REASONS,
} from '../../../constants/escrow.constants';
import {
	SETTLEMENT_PUBLIC_CLIENT,
	SETTLEMENT_RELAYER_WALLET,
} from '../../../constants/settlement.constants';
import { ClaimAttempt } from '../../../entities/claim-attempt.entity';
import { SettlementTransaction } from '../../../entities/settlement-transaction.entity';
import { SettlementTransactionKind } from '../../../enums/settlement-transaction-kind.enum';
import { SettlementTransactionStatus } from '../../../enums/settlement-transaction-status.enum';
import type { RelayerWallet } from '../../../providers/relayer-wallet.provider';
import { HostSettlementOutcomeService } from '../../../services/settlements/host-settlement-outcome.service';
import { WalletTransactionOutcomeService } from '../../../services/wallets/wallet-transaction-outcome.service';
import type {
	MarkSent,
	OperatorCall,
	OperatorTransactionSubject,
} from '../../../types/operator-transaction.types';
import { configuredEscrow } from '../../../utils/escrow/escrow-identity.util';
import { pointSettlementTransactionAt } from '../../../utils/escrow/settlement-transaction-hash.util';
import { RelayerRepricingService } from './relayer-repricing.service';

type Outcome =
	| { status: typeof SettlementTransactionStatus.PENDING }
	| {
			status:
				| typeof SettlementTransactionStatus.SUCCEEDED
				| typeof SettlementTransactionStatus.REVERTED;
			receipt: TransactionReceipt;
	  }
	| { status: typeof SettlementTransactionStatus.DROPPED };

const PENDING_OUTCOME: Outcome = {
	status: SettlementTransactionStatus.PENDING,
};

const CLAIMING_KINDS: ReadonlySet<SettlementTransactionKind> = new Set([
	SettlementTransactionKind.HOST_SETTLEMENT,
	SettlementTransactionKind.CLAIM_BATCH,
]);

@Injectable()
export class OperatorTransactionService {
	private readonly logger = new Logger(OperatorTransactionService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		@Inject(SETTLEMENT_RELAYER_WALLET) private readonly wallet: RelayerWallet,
		private readonly config: TypedConfigService,
		private readonly walletOutcomes: WalletTransactionOutcomeService,
		private readonly settlementOutcomes: HostSettlementOutcomeService,
		private readonly repricing: RelayerRepricingService
	) {}

	async send(
		kind: SettlementTransactionKind,
		call: OperatorCall,
		subject: OperatorTransactionSubject = {},
		markSent?: MarkSent
	): Promise<Hash> {
		const nonce = await this.client.getTransactionCount({
			address: this.wallet.account.address,
			blockTag: 'pending',
		});
		const request = await this.wallet.prepareTransactionRequest({
			to: call.to,
			data: call.data,
			gas: call.gas,
			nonce,
		});
		if (request.maxFeePerGas === undefined) {
			throw new Error(
				'The settlement chain did not price the relayer transaction with EIP-1559 fees'
			);
		}
		const signedTransaction = await this.wallet.signTransaction(request);
		const transactionHash = keccak256(signedTransaction);
		await this.entityManager.fork().transactional(async (manager) => {
			await this.record(manager, {
				kind,
				transactionHash,
				nonce,
				signedTransaction,
				initialMaxFeePerGas: request.maxFeePerGas.toString(),
				subject,
			});
			return markSent?.(manager, transactionHash);
		});
		await this.broadcast(transactionHash, signedTransaction);
		return transactionHash;
	}

	async claimingChannels(manager: EntityManager): Promise<Set<string>> {
		const pending = await manager.find(
			SettlementTransaction,
			{
				...configuredEscrow(this.config),
				kind: { $in: [...CLAIMING_KINDS] },
				status: SettlementTransactionStatus.PENDING,
			},
			{ fields: ['id'] }
		);
		if (pending.length === 0) return new Set();
		const claims = await manager.find(
			ClaimAttempt,
			{ transactionId: { $in: pending.map(({ id }) => id) } },
			{ fields: ['paymentChannelId'] }
		);
		return new Set(claims.map(({ paymentChannelId }) => paymentChannelId));
	}

	async settlePending(): Promise<void> {
		const pending = await this.entityManager.fork().find(
			SettlementTransaction,
			{
				...configuredEscrow(this.config),
				status: SettlementTransactionStatus.PENDING,
			},
			{ orderBy: { nonce: 'ASC', sentAt: 'ASC' } }
		);
		for (const transaction of pending) {
			const outcome = await this.outcome(transaction);
			if (outcome.status === SettlementTransactionStatus.PENDING) continue;
			await this.entityManager.fork().transactional(async (manager) => {
				const current = await manager.findOneOrFail(SettlementTransaction, {
					id: transaction.id,
				});
				current.status = outcome.status;
				current.settledAt = await databaseNow(manager);
				if (
					'receipt' in outcome &&
					outcome.receipt.transactionHash !== current.transactionHash
				) {
					await pointSettlementTransactionAt(
						manager,
						current,
						outcome.receipt.transactionHash
					);
				}
				if (outcome.status === SettlementTransactionStatus.SUCCEEDED) {
					await this.claimsSettled(manager, current, outcome.receipt);
				} else {
					current.error = outcome.status;
					this.logger.warn(
						`Relayer ${current.kind} transaction ${current.transactionHash} ${current.status}`
					);
				}
				await this.walletOutcomes.settle(manager, current);
				await this.settlementOutcomes.settle(manager, current);
			});
		}
	}

	private async record(
		manager: EntityManager,
		fields: Pick<
			SettlementTransaction,
			| 'kind'
			| 'transactionHash'
			| 'nonce'
			| 'signedTransaction'
			| 'initialMaxFeePerGas'
		> & { subject: OperatorTransactionSubject }
	): Promise<void> {
		const { subject, ...sent } = fields;
		const now = await databaseNow(manager);
		const transaction = manager.create(SettlementTransaction, {
			...configuredEscrow(this.config),
			...sent,
			status: SettlementTransactionStatus.PENDING,
			hostAddress: subject.hostAddress ?? null,
			walletTransactionId: subject.walletTransactionId ?? null,
			hostSettlementId: subject.hostSettlementId ?? null,
			error: null,
			sentAt: now,
			signedAt: now,
			settledAt: null,
		});
		await manager.flush();
		(subject.claims ?? []).forEach((claim, itemIndex) => {
			manager.create(ClaimAttempt, {
				...claim,
				transactionId: transaction.id,
				itemIndex,
				paidMicroUsd: null,
				failure: null,
			});
		});
		await manager.flush();
	}

	private async broadcast(hash: Hash, signedTransaction: Hex): Promise<void> {
		try {
			await this.wallet.sendRawTransaction({
				serializedTransaction: signedTransaction,
			});
		} catch (error) {
			this.logger.warn(
				`Broadcasting relayer transaction ${hash} failed; sending it again on the next run: ${errorMessage(error)}`
			);
		}
	}

	private async outcome(transaction: SettlementTransaction): Promise<Outcome> {
		const minedNonce = await this.client.getTransactionCount({
			address: this.wallet.account.address,
			blockTag: 'latest',
		});
		const receipt = await this.minedReceipt(transaction);
		if (receipt) {
			return receipt.status === 'success'
				? { status: SettlementTransactionStatus.SUCCEEDED, receipt }
				: { status: SettlementTransactionStatus.REVERTED, receipt };
		}
		if (minedNonce > transaction.nonce) {
			return { status: SettlementTransactionStatus.DROPPED };
		}
		if (!(await this.known(transaction.transactionHash))) {
			await this.broadcast(
				transaction.transactionHash,
				transaction.signedTransaction
			);
			return PENDING_OUTCOME;
		}
		const repriced = await this.repricing.repriceWhenStuck(transaction);
		if (repriced) {
			await this.broadcast(
				repriced.transactionHash,
				repriced.signedTransaction
			);
		}
		return PENDING_OUTCOME;
	}

	private async minedReceipt(
		transaction: SettlementTransaction
	): Promise<TransactionReceipt | null> {
		for (const hash of [
			transaction.transactionHash,
			...transaction.replacedTransactionHashes,
		]) {
			const receipt = await this.receipt(hash);
			if (receipt) return receipt;
		}
		return null;
	}

	private async receipt(hash: Hash): Promise<TransactionReceipt | null> {
		try {
			return await this.client.getTransactionReceipt({ hash });
		} catch (error) {
			if (error instanceof TransactionReceiptNotFoundError) return null;
			throw error;
		}
	}

	private async known(hash: Hash): Promise<boolean> {
		try {
			await this.client.getTransaction({ hash });
			return true;
		} catch (error) {
			if (error instanceof TransactionNotFoundError) return false;
			throw error;
		}
	}

	private async claimsSettled(
		manager: EntityManager,
		transaction: SettlementTransaction,
		receipt: TransactionReceipt
	): Promise<void> {
		if (!CLAIMING_KINDS.has(transaction.kind)) return;
		const attempts = await manager.find(
			ClaimAttempt,
			{ transactionId: transaction.id },
			{ orderBy: { itemIndex: 'ASC' } }
		);
		if (attempts.length === 0) return;
		const results = parseEventLogs({
			abi: snapflowEscrowAbi,
			eventName: 'ClaimResult',
			logs: receipt.logs,
		});
		attempts.forEach((attempt, index) => {
			const result = results[index];
			if (!result) {
				throw new Error(
					`Claim batch ${transaction.transactionHash} reported ${results.length} results for ${attempts.length} items`
				);
			}
			attempt.paidMicroUsd = result.args.paid.toString();
			attempt.failure =
				CLAIM_FAILURE_REASONS[result.args.reason] ?? CLAIM_FAILURE_OTHER;
		});
	}
}
