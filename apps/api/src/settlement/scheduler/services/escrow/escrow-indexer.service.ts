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
import { Inject, Injectable, Logger } from '@nestjs/common';
import { snapflowEscrowAbi } from '@snapflow/contracts';
import type { PublicClient } from 'viem';
import { LogExecution } from '../../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../../common/decorators/track-job-execution.decorator';
import { fullJitterBackoffMilliseconds } from '../../../../common/utils/concurrency/full-jitter-backoff.util';
import { TrackedJobs } from '../../../../common/utils/concurrency/tracked-jobs.util';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { SettingsService } from '../../../../settings/services/settings.service';
import {
	ESCROW_INDEXER,
	FINALIZED_BLOCK_TAG,
	SAFE_BLOCK_TAG,
} from '../../../constants/escrow.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../../constants/settlement.constants';
import { SettlementAlertKind } from '../../../constants/settlement-alert.constants';
import { SettlementChainCursor } from '../../../entities/settlement-chain-cursor.entity';
import { SettlementAlertService } from '../../../services/alerts/settlement-alert.service';
import { EscrowIngestionService } from '../../../services/escrow/escrow-ingestion.service';
import { EscrowLogReaderService } from '../../../services/escrow/escrow-log-reader.service';
import type { EscrowIdentity, EscrowLog } from '../../../types/escrow.types';
import {
	type BlockRange,
	nextBlockRange,
} from '../../../utils/escrow/block-range.util';
import { minBigInt } from '../../../utils/escrow/escrow-amount.util';
import { chainTimestamp } from '../../../utils/escrow/escrow-event-record.util';
import { configuredEscrow } from '../../../utils/escrow/escrow-identity.util';

@Injectable()
export class EscrowIndexerService extends TrackedJobs {
	protected readonly logger = new Logger(EscrowIndexerService.name);
	private failedRuns = 0;
	private retryAtMilliseconds = 0;

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService,
		private readonly settings: SettingsService,
		private readonly locks: RedisLockProvider,
		private readonly ingestion: EscrowIngestionService,
		private readonly alerts: SettlementAlertService,
		private readonly logs: EscrowLogReaderService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(ESCROW_INDEXER.JOB)
	@CreateRequestContext()
	async indexConfirmedEvents(): Promise<void> {
		if (Date.now() < this.retryAtMilliseconds) return;
		await this.locks.runExclusive(
			ESCROW_INDEXER.JOB,
			ESCROW_INDEXER.LOCK_TTL_SECONDS,
			async () => {
				try {
					const lag = await this.indexRanges(configuredEscrow(this.config));
					this.failedRuns = 0;
					this.retryAtMilliseconds = 0;
					await this.alertWhenLagging(lag);
				} catch (error) {
					const delay = fullJitterBackoffMilliseconds(
						this.failedRuns,
						ESCROW_INDEXER.BACKOFF
					);
					this.failedRuns += 1;
					this.retryAtMilliseconds = Date.now() + delay;
					this.logger.error(
						`Escrow indexing failed ${this.failedRuns} time(s) in a row; retrying in ${delay}ms`,
						error
					);
					await this.alertWhenFailing(error);
				}
			}
		);
	}

	private async alertWhenFailing(error: unknown): Promise<void> {
		if (this.failedRuns < ESCROW_INDEXER.ALERT_AFTER_FAILED_RUNS) return;
		await this.alerts.raise(
			SettlementAlertKind.ESCROW_INDEXER_FAILING,
			`Escrow indexing has failed ${this.failedRuns} runs in a row, so deposits, withdrawals and claim deadlines are not being recorded: ${errorMessage(error)}`
		);
	}

	private async alertWhenLagging(lag: bigint): Promise<void> {
		if (lag <= ESCROW_INDEXER.LAG_ALERT_BLOCKS) return;
		await this.alerts.raise(
			SettlementAlertKind.ESCROW_INDEXER_LAGGING,
			`Escrow indexing is ${lag} blocks behind the confirmed head; withdrawal deadlines may be missed until it catches up`
		);
	}

	private async indexRanges(escrow: EscrowIdentity): Promise<bigint> {
		const { settlementConfirmations, largeDepositConfirmations } =
			await this.settings.get();
		const [head, safe, finalized] = await Promise.all([
			this.client.getBlockNumber({ cacheTime: 0 }),
			this.client.getBlock({ blockTag: SAFE_BLOCK_TAG }),
			this.client.getBlock({ blockTag: FINALIZED_BLOCK_TAG }),
		]);
		const confirmedHead = minBigInt(
			head - BigInt(settlementConfirmations),
			safe.number
		);
		const finalizedBlock = Number(
			minBigInt(head - BigInt(largeDepositConfirmations), finalized.number)
		);
		const firstBlock = BigInt(
			this.config.get('settlement.escrowDeploymentBlock')
		);
		const rangesPerRun = this.config.get('settlement.indexerRangesPerRun');
		let lastIndexedBlock = await this.lastIndexedBlock(escrow);
		for (let ranges = 0; ranges < rangesPerRun; ranges += 1) {
			const range = nextBlockRange(
				lastIndexedBlock,
				firstBlock,
				confirmedHead,
				this.logs.maximumBlocks
			);
			if (range === null) return 0n;
			await this.indexRange(escrow, range, finalizedBlock);
			lastIndexedBlock = range.toBlock;
		}
		return confirmedHead - (lastIndexedBlock ?? firstBlock);
	}

	private async indexRange(
		escrow: EscrowIdentity,
		range: BlockRange,
		finalizedBlock: number
	): Promise<void> {
		const logs = await this.logs.read(range, (page) =>
			this.client.getContractEvents({
				address: escrow.contractAddress,
				abi: snapflowEscrowAbi,
				fromBlock: page.fromBlock,
				toBlock: page.toBlock,
				strict: true,
			})
		);
		const timestamps = await this.blockTimestamps(logs);
		await this.entityManager
			.fork()
			.transactional((manager) =>
				this.ingestion.ingest(
					manager,
					escrow,
					range,
					logs,
					timestamps,
					finalizedBlock
				)
			);
	}

	private async lastIndexedBlock(
		escrow: EscrowIdentity
	): Promise<bigint | null> {
		const cursor = await this.entityManager
			.fork()
			.findOne(SettlementChainCursor, escrow);
		return cursor ? BigInt(cursor.lastIndexedBlock) : null;
	}

	private async blockTimestamps(
		logs: readonly EscrowLog[]
	): Promise<Map<bigint, Date>> {
		const timestamps = new Map<bigint, Date>();
		for (const log of logs) {
			if (timestamps.has(log.blockNumber)) continue;
			const block = await this.client.getBlock({
				blockNumber: log.blockNumber,
			});
			if (block.hash !== log.blockHash) {
				throw new Error(
					`Block ${log.blockNumber} changed while its escrow events were read`
				);
			}
			timestamps.set(log.blockNumber, chainTimestamp(block.timestamp));
		}
		return timestamps;
	}
}
