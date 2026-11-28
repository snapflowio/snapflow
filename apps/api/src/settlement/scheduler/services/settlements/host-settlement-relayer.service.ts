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
import { isAddressEqual } from 'viem';
import { addSeconds } from '../../../../common/utils/time.util';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { Machine } from '../../../../machine/entities/machine.entity';
import {
	HOST_SETTLEMENT_FAILURE,
	HOST_WITHDRAWAL_SIGNATURE_SECONDS,
	SETTLEMENT_OPERATOR,
} from '../../../constants/host-settlement.constants';
import { HostSettlement } from '../../../entities/host-settlement.entity';
import { HostSettlementStatus } from '../../../enums/host-settlement-status.enum';
import { SettlementTransactionKind } from '../../../enums/settlement-transaction-kind.enum';
import { readyPayoutWallet } from '../../../queries/payout-wallet.query';
import { settlementClaims } from '../../../queries/settlement-claims.query';
import { ChainClockService } from '../../../services/escrow/chain-clock.service';
import { HostSettlementChainService } from '../../../services/settlements/host-settlement-chain.service';
import { HostSettlementOutcomeService } from '../../../services/settlements/host-settlement-outcome.service';
import { microUsd } from '../../../utils/escrow/escrow-amount.util';
import { configuredEscrow } from '../../../utils/escrow/escrow-identity.util';
import {
	failQueued,
	relayEach,
} from '../../../utils/operator/operator-queue.util';
import { hostSettlementCalldata } from '../../../utils/settlements/host-settlement-call.util';
import { OperatorTransactionService } from '../operator/operator-transaction.service';

@Injectable()
export class HostSettlementRelayerService {
	private readonly logger = new Logger(HostSettlementRelayerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly chain: HostSettlementChainService,
		private readonly transactions: OperatorTransactionService,
		private readonly outcomes: HostSettlementOutcomeService,
		private readonly chainClock: ChainClockService
	) {}

	async relayQueued(): Promise<void> {
		const queued = await this.entityManager.fork().find(
			HostSettlement,
			{
				...configuredEscrow(this.config),
				status: HostSettlementStatus.QUEUED,
			},
			{
				orderBy: { createdAt: QueryOrder.ASC },
				limit: SETTLEMENT_OPERATOR.BATCH_SIZE,
			}
		);
		await relayEach(queued, this.logger, {
			relay: ({ id }) => this.relay(id),
			fail: (settlement, reason) => this.fail(settlement, reason),
		});
	}

	private async relay(hostSettlementId: string): Promise<void> {
		const manager = this.entityManager.fork();
		const settlement = await manager.findOneOrFail(HostSettlement, {
			id: hostSettlementId,
		});
		const now = await this.chainClock.now();
		if (
			settlement.deadline <=
			addSeconds(now, HOST_WITHDRAWAL_SIGNATURE_SECONDS.MINIMUM_REMAINING)
		) {
			return this.fail(settlement, HOST_SETTLEMENT_FAILURE.EXPIRED);
		}
		const { organizationId } = await manager.findOneOrFail(
			Machine,
			{ id: settlement.machineId },
			{ fields: ['organizationId'] }
		);
		const payout = await readyPayoutWallet(manager, organizationId);
		if (!payout || !isAddressEqual(payout, settlement.payoutAddress)) {
			return this.fail(settlement, HOST_SETTLEMENT_FAILURE.PAYOUT_CHANGED);
		}
		const data = hostSettlementCalldata(
			settlement,
			await settlementClaims(manager, settlement.items)
		);
		const simulation = await this.chain.simulate(data, settlement.items.length);
		if (simulation.failure !== null) {
			return this.fail(settlement, simulation.failure);
		}
		if (microUsd(settlement.relayFeeMicroUsd) < simulation.requiredFee) {
			return this.fail(settlement, HOST_SETTLEMENT_FAILURE.UNDERPAID);
		}
		await this.transactions.send(
			SettlementTransactionKind.HOST_SETTLEMENT,
			{
				to: this.config.get('settlement.escrowAddress'),
				data,
				gas: simulation.gas,
			},
			{
				hostAddress: settlement.hostAddress,
				hostSettlementId: settlement.id,
				claims: settlement.items,
			},
			async (manager, hash) => {
				const current = await manager.findOneOrFail(HostSettlement, {
					id: settlement.id,
				});
				manager.assign(current, {
					status: HostSettlementStatus.SENT,
					transactionHash: hash,
					error: null,
				});
			}
		);
	}

	private fail(
		settlement: Pick<HostSettlement, 'id'>,
		reason: string
	): Promise<void> {
		return failQueued(this.entityManager, this.logger, this.outcomes, {
			id: settlement.id,
			description: `Host settlement ${settlement.id}`,
			reason,
		});
	}
}
