/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { MAX_BATCH_SIZE } from '@snapflow/contracts';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { addSeconds } from '../../../../common/utils/time.util';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { DEADLINE_CLAIMS } from '../../../constants/host-settlement.constants';
import { SettlementAlertKind } from '../../../constants/settlement-alert.constants';
import { SettlementTransactionKind } from '../../../enums/settlement-transaction-kind.enum';
import { hostClaimsDueBy } from '../../../queries/claim-deadline.query';
import { settlementClaims } from '../../../queries/settlement-claims.query';
import { SettlementAlertService } from '../../../services/alerts/settlement-alert.service';
import { ChainClockService } from '../../../services/escrow/chain-clock.service';
import type { HostSettlementItem } from '../../../types/host-settlement.types';
import type { ClaimBatchCall } from '../../../types/operator-transaction.types';
import {
	contractRevertReason,
	isChainUnreachable,
} from '../../../utils/chain-error.util';
import { configuredEscrow } from '../../../utils/escrow/escrow-identity.util';
import { EscrowWriterService } from '../escrow/escrow-writer.service';
import { OperatorTransactionService } from '../operator/operator-transaction.service';

@Injectable()
export class DeadlineClaimService {
	private readonly logger = new Logger(DeadlineClaimService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly locks: RedisLockProvider,
		private readonly chainClock: ChainClockService,
		private readonly writer: EscrowWriterService,
		private readonly transactions: OperatorTransactionService,
		private readonly alerts: SettlementAlertService
	) {}

	async claimDue(): Promise<void> {
		const due = await this.locks.claim(
			DEADLINE_CLAIMS.CLAIM_KEY,
			DEADLINE_CLAIMS.INTERVAL_SECONDS
		);
		if (!due) return;
		try {
			await this.claim();
		} catch (error) {
			await this.locks.releaseClaim(DEADLINE_CLAIMS.CLAIM_KEY);
			await this.alerts.raise(
				isChainUnreachable(error)
					? SettlementAlertKind.CHAIN_UNREACHABLE
					: SettlementAlertKind.DEADLINE_CLAIM_FAILED,
				`Claiming host channels before their deadline failed; retrying on the next run: ${errorMessage(error)}`
			);
			throw error;
		}
	}

	private async claim(): Promise<void> {
		const manager = this.entityManager.fork();
		const cutoff = addSeconds(
			await this.chainClock.now(),
			DEADLINE_CLAIMS.NOTICE_SECONDS
		);
		const claiming = await this.transactions.claimingChannels(manager);
		const claims = (
			await hostClaimsDueBy(manager, configuredEscrow(this.config), cutoff)
		).filter(({ paymentChannelId }) => !claiming.has(paymentChannelId));
		for (let start = 0; start < claims.length; start += MAX_BATCH_SIZE) {
			await this.claimBatch(
				manager,
				claims.slice(start, start + MAX_BATCH_SIZE),
				cutoff
			);
		}
	}

	private async claimBatch(
		manager: EntityManager,
		batch: readonly HostSettlementItem[],
		cutoff: Date
	): Promise<void> {
		const items = await settlementClaims(manager, batch);
		let simulated: ClaimBatchCall;
		try {
			simulated = await this.writer.claimBatch(items);
		} catch (error) {
			if (isChainUnreachable(error)) throw error;
			await this.alerts.raise(
				SettlementAlertKind.DEADLINE_CLAIM_FAILED,
				`Claiming ${batch.length} host channels whose deadline comes before ${cutoff.toISOString()} failed; retrying on the next run: ${contractRevertReason(error)}`
			);
			return;
		}
		if (simulated.paid === 0n) {
			await this.alerts.raise(
				SettlementAlertKind.DEADLINE_CLAIM_UNPAID,
				`The escrow would pay nothing for ${batch.length} host channels whose deadline comes before ${cutoff.toISOString()}; their customers' balance or signers no longer cover them`
			);
			return;
		}
		await this.transactions.send(
			SettlementTransactionKind.CLAIM_BATCH,
			simulated.call,
			{ claims: batch }
		);
		this.logger.log(
			`Claimed ${batch.length} host channels into their hosts' escrow balance before their deadline, ${simulated.paid} micro-USD`
		);
	}
}
