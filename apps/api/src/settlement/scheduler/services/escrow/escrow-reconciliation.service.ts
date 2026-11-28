/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { IsolationLevel } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { snapflowEscrowAbi } from '@snapflow/contracts';
import type { Address, PublicClient } from 'viem';
import { chunks } from '../../../../common/utils/array-chunks.util';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { ESCROW_RECONCILIATION } from '../../../constants/escrow.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../../constants/settlement.constants';
import { SettlementAlertKind } from '../../../constants/settlement-alert.constants';
import { EscrowAccount } from '../../../entities/escrow-account.entity';
import { SettlementChainCursor } from '../../../entities/settlement-chain-cursor.entity';
import { SettlementAlertService } from '../../../services/alerts/settlement-alert.service';
import { configuredEscrow } from '../../../utils/escrow/escrow-identity.util';
import {
	balanceDrifts,
	describeDrift,
	type EscrowBalances,
	type EscrowDrift,
	escrowDrift,
	escrowHeldTotals,
	heldBalance,
	largestDrifts,
	type ProjectedEscrowAccount,
	projectedBalances,
	RECONCILED_BALANCES,
	TOTAL_HELD,
} from '../../../utils/escrow/escrow-reconciliation.util';

@Injectable()
export class EscrowReconciliationService {
	private readonly logger = new Logger(EscrowReconciliationService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService,
		private readonly locks: RedisLockProvider,
		private readonly alerts: SettlementAlertService
	) {}

	async reconcileDue(): Promise<void> {
		const due = await this.locks.claim(
			ESCROW_RECONCILIATION.CLAIM_KEY,
			ESCROW_RECONCILIATION.CLAIM_SECONDS
		);
		if (!due) return;
		try {
			await this.reconcile();
		} catch (error) {
			await this.locks.releaseClaim(ESCROW_RECONCILIATION.CLAIM_KEY);
			await this.alerts.raise(
				SettlementAlertKind.ESCROW_RECONCILIATION_FAILED,
				`The daily escrow reconciliation failed and will run again on the next schedule: ${errorMessage(error)}`
			);
			throw error;
		}
	}

	private async reconcile(): Promise<void> {
		const snapshot = await this.projection();
		if (!snapshot) return;
		const { blockNumber, accounts } = snapshot;
		const drifts: EscrowDrift[] = [];
		let projectedHeld = 0n;
		for (const batch of chunks(
			accounts,
			ESCROW_RECONCILIATION.ACCOUNTS_PER_MULTICALL
		)) {
			const onChain = await this.onChainBalances(
				batch.map((account) => account.address),
				blockNumber
			);
			batch.forEach((account, index) => {
				const projected = projectedBalances(account);
				projectedHeld += heldBalance(projected);
				drifts.push(
					...balanceDrifts(account.address, projected, onChain[index])
				);
			});
		}
		const { totalHeld, tokenBalance } = await escrowHeldTotals(
			this.client,
			this.config.get('settlement.escrowAddress'),
			this.config.get('settlement.usdcAddress'),
			blockNumber
		);
		if (totalHeld !== projectedHeld) {
			drifts.push(
				escrowDrift(TOTAL_HELD, TOTAL_HELD, projectedHeld, totalHeld)
			);
		}
		if (tokenBalance < totalHeld) {
			drifts.push(
				escrowDrift(
					this.config.get('settlement.escrowAddress'),
					TOTAL_HELD,
					totalHeld,
					tokenBalance
				)
			);
		}
		this.logger.log(
			`Reconciled ${accounts.length} escrow accounts at block ${blockNumber}: ${drifts.length} differences, ${MicroUsd.of(totalHeld).toUsd()} USDC held`
		);
		if (drifts.length === 0) return;
		await this.alerts.raise(
			SettlementAlertKind.ESCROW_RECONCILIATION_DRIFT,
			[
				`The escrow projection differs from the chain at block ${blockNumber} in ${drifts.length} balances. Nothing was corrected; the largest are:`,
				...largestDrifts(drifts, ESCROW_RECONCILIATION.REPORTED_DRIFTS).map(
					describeDrift
				),
			].join('\n')
		);
	}

	private projection(): Promise<{
		blockNumber: bigint;
		accounts: ProjectedEscrowAccount[];
	} | null> {
		const escrow = configuredEscrow(this.config);
		return this.entityManager.fork().transactional(
			async (manager) => {
				const cursor = await manager.findOne(SettlementChainCursor, escrow);
				if (!cursor) return null;
				const accounts = await manager.find(EscrowAccount, escrow, {
					fields: ['address', ...RECONCILED_BALANCES],
					orderBy: { address: 'ASC' },
				});
				return { blockNumber: BigInt(cursor.lastIndexedBlock), accounts };
			},
			{ isolationLevel: IsolationLevel.REPEATABLE_READ, readOnly: true }
		);
	}

	private async onChainBalances(
		addresses: readonly Address[],
		blockNumber: bigint
	): Promise<EscrowBalances[]> {
		const escrow = {
			address: this.config.get('settlement.escrowAddress'),
			abi: snapflowEscrowAbi,
		} as const;
		const options = {
			allowFailure: false,
			blockNumber,
			deployless: this.client.chain?.contracts?.multicall3 === undefined,
		} as const;
		const [accounts, hostBalances, feesAccrued, frozen] = await Promise.all([
			this.client.multicall({
				...options,
				contracts: addresses.map(
					(account) =>
						({ ...escrow, functionName: 'accountOf', args: [account] }) as const
				),
			}),
			this.client.multicall({
				...options,
				contracts: addresses.map(
					(account) =>
						({
							...escrow,
							functionName: 'hostBalanceOf',
							args: [account],
						}) as const
				),
			}),
			this.client.multicall({
				...options,
				contracts: addresses.map(
					(account) =>
						({
							...escrow,
							functionName: 'feesAccruedOf',
							args: [account],
						}) as const
				),
			}),
			this.client.multicall({
				...options,
				contracts: addresses.map(
					(account) =>
						({
							...escrow,
							functionName: 'frozenBalanceOf',
							args: [account],
						}) as const
				),
			}),
		]);
		return accounts.map((account, index) => ({
			freeMicroUsd: account.free,
			pendingMicroUsd: account.pending,
			hostBalanceMicroUsd: hostBalances[index],
			feesAccruedMicroUsd: feesAccrued[index],
			frozenMicroUsd: frozen[index],
		}));
	}
}
