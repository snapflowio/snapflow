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
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { fullJitterBackoffMilliseconds } from '../../../common/utils/concurrency/full-jitter-backoff.util';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { SettingsService } from '../../../settings/services/settings.service';
import { ESCROW_INDEXER } from '../../constants/escrow.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../constants/settlement.constants';
import { SettlementChainCursor } from '../../entities/settlement-chain-cursor.entity';
import { EscrowIngestionService } from '../../services/escrow-ingestion.service';
import type { EscrowIdentity, EscrowLog } from '../../types/escrow.types';
import { type BlockRange, nextBlockRange } from '../../utils/block-range.util';
import { chainTimestamp } from '../../utils/escrow-event-record.util';
import { configuredEscrow } from '../../utils/escrow-identity.util';

// Follows the escrow's events up to the confirmed head, one bounded block
// range per transaction. Only blocks the settings' confirmation depth has
// buried are read, so a reorg never reaches indexed data.
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
		private readonly ingestion: EscrowIngestionService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	// A failed run (RPC outage, rate limit, a block that changed under us) is
	// logged and retried after a jittered exponential backoff; the cursor has
	// not moved past anything that was not stored.
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
					await this.indexRanges(configuredEscrow(this.config));
					this.failedRuns = 0;
					this.retryAtMilliseconds = 0;
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
				}
			}
		);
	}

	private async indexRanges(escrow: EscrowIdentity): Promise<void> {
		const { settlementConfirmations } = await this.settings.get();
		const head = await this.client.getBlockNumber({ cacheTime: 0 });
		const confirmedHead = head - BigInt(settlementConfirmations);
		const firstBlock = BigInt(
			this.config.get('settlement.escrowDeploymentBlock')
		);
		let lastIndexedBlock = await this.lastIndexedBlock(escrow);
		for (
			let ranges = 0;
			ranges < ESCROW_INDEXER.MAXIMUM_RANGES_PER_RUN;
			ranges += 1
		) {
			const range = nextBlockRange(
				lastIndexedBlock,
				firstBlock,
				confirmedHead,
				ESCROW_INDEXER.MAXIMUM_BLOCK_RANGE
			);
			if (range === null) return;
			await this.indexRange(escrow, range);
			lastIndexedBlock = range.toBlock;
		}
	}

	private async indexRange(
		escrow: EscrowIdentity,
		range: BlockRange
	): Promise<void> {
		const logs = await this.client.getContractEvents({
			address: escrow.contractAddress,
			abi: snapflowEscrowAbi,
			fromBlock: range.fromBlock,
			toBlock: range.toBlock,
			strict: true,
		});
		const timestamps = await this.blockTimestamps(logs);
		await this.entityManager
			.fork()
			.transactional((manager) =>
				this.ingestion.ingest(manager, escrow, range, logs, timestamps)
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

	// Reading each block also proves the logs still belong to the canonical
	// chain: a hash mismatch fails the run instead of storing orphaned events.
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
