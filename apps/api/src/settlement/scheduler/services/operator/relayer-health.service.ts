/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';
import { batchItemsGas, MAX_BATCH_SIZE } from '@snapflow/contracts';
import { formatEther, formatGwei, type PublicClient } from 'viem';
import { addSeconds } from '../../../../common/utils/time.util';
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { CLAIM_BATCH_OVERHEAD_GAS } from '../../../constants/host-settlement.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../../constants/settlement.constants';
import {
	RELAYER_HEALTH,
	SettlementAlertKind,
} from '../../../constants/settlement-alert.constants';
import { WALLET_GAS } from '../../../constants/user-wallet.constants';
import { SettlementTransaction } from '../../../entities/settlement-transaction.entity';
import { SettlementTransactionStatus } from '../../../enums/settlement-transaction-status.enum';
import { refundsDue } from '../../../queries/refunds-due.query';
import { SettlementAlertService } from '../../../services/alerts/settlement-alert.service';
import { configuredEscrow } from '../../../utils/escrow/escrow-identity.util';

const FULL_CLAIM_BATCH_GAS =
	WALLET_GAS.TRANSACTION +
	CLAIM_BATCH_OVERHEAD_GAS +
	batchItemsGas(MAX_BATCH_SIZE);

@Injectable()
export class RelayerHealthService {
	constructor(
		private readonly entityManager: EntityManager,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService,
		private readonly locks: RedisLockProvider,
		private readonly alerts: SettlementAlertService
	) {}

	async checkDue(): Promise<void> {
		const due = await this.locks.claim(
			RELAYER_HEALTH.CLAIM_KEY,
			RELAYER_HEALTH.INTERVAL_SECONDS
		);
		if (!due) return;
		try {
			await this.checkBalance();
			await this.checkStalledTransactions();
			await this.checkRefundsDue();
		} catch (error) {
			await this.locks.releaseClaim(RELAYER_HEALTH.CLAIM_KEY);
			throw error;
		}
	}

	private async checkBalance(): Promise<void> {
		const relayer = this.config.get('settlement.relayerAddress');
		const [balance, fees] = await Promise.all([
			this.client.getBalance({ address: relayer }),
			this.client.estimateFeesPerGas(),
		]);
		const runway =
			fees.maxFeePerGas *
			FULL_CLAIM_BATCH_GAS *
			RELAYER_HEALTH.RUNWAY_CLAIM_BATCHES;
		if (balance >= runway) return;
		await this.alerts.raise(
			SettlementAlertKind.RELAYER_BALANCE_LOW,
			`The settlement relayer ${relayer} holds ${formatEther(balance)} ETH, less than the ${formatEther(runway)} ETH that ${RELAYER_HEALTH.RUNWAY_CLAIM_BATCHES} full claim batches cost at ${formatGwei(fees.maxFeePerGas)} gwei. Fund it so deadline claims and host settlements keep landing.`
		);
	}

	private async checkStalledTransactions(): Promise<void> {
		const manager = this.entityManager.fork();
		const stalledBefore = addSeconds(
			await databaseNow(manager),
			-RELAYER_HEALTH.STALLED_TRANSACTION_SECONDS
		);
		const stalled = await manager.find(
			SettlementTransaction,
			{
				...configuredEscrow(this.config),
				status: SettlementTransactionStatus.PENDING,
				sentAt: { $lt: stalledBefore },
			},
			{ orderBy: { sentAt: 'ASC' } }
		);
		const [oldest] = stalled;
		if (!oldest) return;
		await this.alerts.raise(
			SettlementAlertKind.RELAYER_TRANSACTION_STALLED,
			`${stalled.length} settlement relayer transactions have been pending for more than ${RELAYER_HEALTH.STALLED_TRANSACTION_SECONDS} seconds; the oldest, ${oldest.kind} ${oldest.transactionHash} with nonce ${oldest.nonce}, was sent at ${oldest.sentAt.toISOString()}. Channels they claim are skipped by the deadline keeper until they land.`
		);
	}

	private async checkRefundsDue(): Promise<void> {
		const due = await refundsDue(
			this.entityManager.fork(),
			configuredEscrow(this.config)
		);
		if (due.length === 0) return;
		const total = MicroUsd.sum(due.map(({ dueMicroUsd }) => dueMicroUsd));
		await this.alerts.raise(
			SettlementAlertKind.REFUNDS_DUE,
			`${due.length} ended sandbox payment channels owe customers ${total.toUsd()} USDC in credits granted after their vouchers were signed. Send each refund from the fee wallet, then record its transaction hash with "Record refund" on the admin Refunds page.`
		);
	}
}
