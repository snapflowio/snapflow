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
import { encodeFunctionData, type PublicClient } from 'viem';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { ESCROW_CIRCUIT_BREAKER } from '../../../constants/escrow.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../../constants/settlement.constants';
import { SettlementAlertKind } from '../../../constants/settlement-alert.constants';
import { SettlementTransaction } from '../../../entities/settlement-transaction.entity';
import { SettlementTransactionKind } from '../../../enums/settlement-transaction-kind.enum';
import { SettlementTransactionStatus } from '../../../enums/settlement-transaction-status.enum';
import { SettlementAlertService } from '../../../services/alerts/settlement-alert.service';
import { configuredEscrow } from '../../../utils/escrow/escrow-identity.util';
import { escrowHeldTotals } from '../../../utils/escrow/escrow-reconciliation.util';
import { OperatorTransactionService } from '../operator/operator-transaction.service';

@Injectable()
export class EscrowCircuitBreakerService {
	private readonly logger = new Logger(EscrowCircuitBreakerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService,
		private readonly locks: RedisLockProvider,
		private readonly alerts: SettlementAlertService,
		private readonly transactions: OperatorTransactionService
	) {}

	async guardDue(): Promise<void> {
		const due = await this.locks.claim(
			ESCROW_CIRCUIT_BREAKER.CLAIM_KEY,
			ESCROW_CIRCUIT_BREAKER.INTERVAL_SECONDS
		);
		if (!due) return;
		try {
			await this.guard();
		} catch (error) {
			await this.locks.releaseClaim(ESCROW_CIRCUIT_BREAKER.CLAIM_KEY);
			throw error;
		}
	}

	private async guard(): Promise<void> {
		const escrowAddress = this.config.get('settlement.escrowAddress');
		const blockNumber = await this.client.getBlockNumber();
		const { totalHeld, tokenBalance } = await escrowHeldTotals(
			this.client,
			escrowAddress,
			this.config.get('settlement.usdcAddress'),
			blockNumber
		);
		if (tokenBalance >= totalHeld) return;
		const pauseState = await this.pause().catch(
			(error: unknown) =>
				`The relayer could not pause the escrow (${errorMessage(error)}), so deposits may still be open: pause() from the Safe now.`
		);
		this.logger.error(
			`Escrow ${escrowAddress} is short ${MicroUsd.of(totalHeld - tokenBalance).toUsd()} USDC at block ${blockNumber}: ${pauseState}`
		);
		await this.alerts.raise(
			SettlementAlertKind.ESCROW_INSOLVENT,
			`The escrow ${escrowAddress} holds ${MicroUsd.of(tokenBalance).toUsd()} USDC but owes ${MicroUsd.of(totalHeld).toUsd()} USDC at block ${blockNumber}, a shortfall that only a contract fault or exploit can cause. ${pauseState} Investigate before unpausing from the admin Safe.`
		);
	}

	private async pause(): Promise<string> {
		const escrowAddress = this.config.get('settlement.escrowAddress');
		const relayer = this.config.get('settlement.relayerAddress');
		const escrow = { address: escrowAddress, abi: snapflowEscrowAbi } as const;
		const [paused, pauserRole] = await Promise.all([
			this.client.readContract({ ...escrow, functionName: 'paused' }),
			this.client.readContract({ ...escrow, functionName: 'PAUSER_ROLE' }),
		]);
		if (paused) return 'Deposits are already paused.';
		const canPause = await this.client.readContract({
			...escrow,
			functionName: 'hasRole',
			args: [pauserRole, relayer],
		});
		if (!canPause) {
			return `The relayer ${relayer} cannot pause the escrow, so deposits are still open: pause() from the Safe now.`;
		}
		if (await this.pausePending()) {
			return 'The relayer has already sent pause(); deposits stop once it lands.';
		}
		const hash = await this.transactions.send(
			SettlementTransactionKind.PAUSE_ESCROW,
			{
				to: escrowAddress,
				data: encodeFunctionData({
					abi: snapflowEscrowAbi,
					functionName: 'pause',
				}),
			}
		);
		return `The relayer sent pause() in ${hash}; deposits stop once it lands.`;
	}

	private async pausePending(): Promise<boolean> {
		const pending = await this.entityManager
			.fork()
			.count(SettlementTransaction, {
				...configuredEscrow(this.config),
				kind: SettlementTransactionKind.PAUSE_ESCROW,
				status: SettlementTransactionStatus.PENDING,
			});
		return pending > 0;
	}
}
