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
import {
	type FeeValuesEIP1559,
	formatGwei,
	type Hash,
	type Hex,
	keccak256,
	type PublicClient,
	parseTransaction,
} from 'viem';
import { addSeconds } from '../../../../common/utils/time.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import {
	RELAYER_FEE_BUMP,
	SETTLEMENT_PUBLIC_CLIENT,
	SETTLEMENT_RELAYER_WALLET,
} from '../../../constants/settlement.constants';
import { SettlementAlertKind } from '../../../constants/settlement-alert.constants';
import { SettlementTransaction } from '../../../entities/settlement-transaction.entity';
import { SettlementTransactionStatus } from '../../../enums/settlement-transaction-status.enum';
import type { RelayerWallet } from '../../../providers/relayer-wallet.provider';
import { SettlementAlertService } from '../../../services/alerts/settlement-alert.service';
import {
	replacementFeeCap,
	replacementFees,
} from '../../../utils/escrow/relayer-fee-bump.util';
import { pointSettlementTransactionAt } from '../../../utils/escrow/settlement-transaction-hash.util';

@Injectable()
export class RelayerRepricingService {
	private readonly logger = new Logger(RelayerRepricingService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		@Inject(SETTLEMENT_RELAYER_WALLET) private readonly wallet: RelayerWallet,
		private readonly alerts: SettlementAlertService
	) {}

	async repriceWhenStuck(
		transaction: SettlementTransaction
	): Promise<{ transactionHash: Hash; signedTransaction: Hex } | null> {
		const manager = this.entityManager.fork();
		const replaceAfter = addSeconds(
			transaction.signedAt,
			RELAYER_FEE_BUMP.REPLACE_AFTER_SECONDS
		);
		if ((await databaseNow(manager)) < replaceAfter) return null;
		const previous = parseTransaction(transaction.signedTransaction);
		if (
			!previous.to ||
			previous.maxFeePerGas === undefined ||
			previous.maxPriorityFeePerGas === undefined
		) {
			throw new Error(
				`Relayer transaction ${transaction.transactionHash} is not an EIP-1559 call and cannot be repriced`
			);
		}
		const fees = replacementFees(
			{
				maxFeePerGas: previous.maxFeePerGas,
				maxPriorityFeePerGas: previous.maxPriorityFeePerGas,
			},
			await this.client.estimateFeesPerGas()
		);
		if (await this.capReached(transaction, fees)) return null;
		const request = await this.wallet.prepareTransactionRequest({
			to: previous.to,
			data: previous.data,
			gas: previous.gas,
			nonce: transaction.nonce,
			...fees,
		});
		const signedTransaction = await this.wallet.signTransaction(request);
		const transactionHash = keccak256(signedTransaction);
		const replaced = await manager.transactional(async (transactional) => {
			const current = await transactional.findOneOrFail(SettlementTransaction, {
				id: transaction.id,
			});
			if (
				current.status !== SettlementTransactionStatus.PENDING ||
				current.transactionHash !== transaction.transactionHash
			) {
				return false;
			}
			current.replacedTransactionHashes = [
				...current.replacedTransactionHashes,
				current.transactionHash,
			];
			current.signedTransaction = signedTransaction;
			current.signedAt = await databaseNow(transactional);
			await pointSettlementTransactionAt(
				transactional,
				current,
				transactionHash
			);
			return true;
		});
		if (!replaced) return null;
		this.logger.warn(
			`Repriced stuck relayer ${transaction.kind} transaction ${transaction.transactionHash} as ${transactionHash} at ${formatGwei(fees.maxFeePerGas)} gwei`
		);
		return { transactionHash, signedTransaction };
	}

	private async capReached(
		transaction: SettlementTransaction,
		fees: FeeValuesEIP1559
	): Promise<boolean> {
		const cap = replacementFeeCap(transaction.initialMaxFeePerGas);
		if (fees.maxFeePerGas <= cap) return false;
		await this.alerts.raise(
			SettlementAlertKind.RELAYER_FEE_CAP_REACHED,
			`Relayer ${transaction.kind} transaction ${transaction.transactionHash} with nonce ${transaction.nonce} is stuck and repricing it needs ${formatGwei(fees.maxFeePerGas)} gwei, above the ${formatGwei(cap)} gwei cap. Replace or cancel nonce ${transaction.nonce} by hand.`
		);
		return true;
	}
}
