/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { LogExecution } from '../../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../../common/utils/concurrency/tracked-jobs.util';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { SETTLEMENT_OPERATOR } from '../../../constants/host-settlement.constants';
import { isChainUnreachable } from '../../../utils/chain-error.util';
import { AutoTopUpKeeperService } from '../auto-top-up/auto-top-up-keeper.service';
import { EscrowCircuitBreakerService } from '../escrow/escrow-circuit-breaker.service';
import { DeadlineClaimService } from '../settlements/deadline-claim.service';
import { HostSettlementRelayerService } from '../settlements/host-settlement-relayer.service';
import { PlatformSettlementService } from '../settlements/platform-settlement.service';
import { WalletRelayerService } from '../wallets/wallet-relayer.service';
import { OperatorTransactionService } from './operator-transaction.service';
import { RelayerHealthService } from './relayer-health.service';

@Injectable()
export class SettlementOperatorService extends TrackedJobs {
	protected readonly logger = new Logger(SettlementOperatorService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly locks: RedisLockProvider,
		private readonly transactions: OperatorTransactionService,
		private readonly circuitBreaker: EscrowCircuitBreakerService,
		private readonly walletRelayer: WalletRelayerService,
		private readonly hostSettlements: HostSettlementRelayerService,
		private readonly platformSettlement: PlatformSettlementService,
		private readonly deadlineClaims: DeadlineClaimService,
		private readonly autoTopUps: AutoTopUpKeeperService,
		private readonly relayerHealth: RelayerHealthService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(SETTLEMENT_OPERATOR.JOB)
	@CreateRequestContext()
	async operate(): Promise<void> {
		await this.locks.runExclusive(
			SETTLEMENT_OPERATOR.JOB,
			SETTLEMENT_OPERATOR.LOCK_TTL_SECONDS,
			() => this.run()
		);
	}

	private async run(): Promise<void> {
		const steps: readonly [string, () => Promise<void>][] = [
			['guard escrow solvency', () => this.circuitBreaker.guardDue()],
			['settle transactions', () => this.transactions.settlePending()],
			['relay wallet transactions', () => this.walletRelayer.relayQueued()],
			['relay host settlements', () => this.hostSettlements.relayQueued()],
			[
				'claim host channels before their deadline',
				() => this.deadlineClaims.claimDue(),
			],
			['top up balances', () => this.autoTopUps.topUpDue()],
			['check relayer health', () => this.relayerHealth.checkDue()],
			['settle platform channels', () => this.platformSettlement.settleDue()],
		];
		for (const [name, step] of steps) {
			try {
				await step();
			} catch (error) {
				this.logger.error(
					`Settlement operator step "${name}" failed; retrying on the next run`,
					error
				);
				if (isChainUnreachable(error)) return;
			}
		}
	}
}
