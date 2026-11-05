/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ForeignKeyConstraintViolationException,
	RequestContext,
} from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { SandboxLastActivity } from '../../entities/sandbox-last-activity.entity';

const REDIS_ACTIVITY_KEY = 'sandbox:activity';
const FLUSH_LOCK_TTL_SECONDS = 30;
const FLUSH_LOCK_KEY = 'flush-activity-to-db-lock';
const SANDBOX_ACTIVITY_THROTTLE_SECONDS = 5;
const SANDBOX_ACTIVITY_FLUSH_BATCH_SIZE = 1_000;

interface SandboxActivityUpdate {
	sandboxId: string;
	lastActivityAt: Date;
}

@Injectable()
export class SandboxActivityService {
	private readonly logger = new Logger(SandboxActivityService.name);

	constructor(
		@InjectRedis() private readonly redis: Redis,
		private readonly entityManager: EntityManager,
		private readonly redisLockProvider: RedisLockProvider
	) {}

	async updateLastActivityAt(
		sandboxId: string,
		lastActivityAt: Date
	): Promise<void> {
		const lockKey = `sandbox:update-last-activity:${sandboxId}`;
		const acquired = await this.redisLockProvider.claim(
			lockKey,
			SANDBOX_ACTIVITY_THROTTLE_SECONDS
		);
		if (!acquired) {
			return;
		}
		await this.redis.zadd(
			REDIS_ACTIVITY_KEY,
			lastActivityAt.getTime(),
			sandboxId
		);
	}

	async getLastActivityAt(sandboxId: string): Promise<Date | null> {
		const score = await this.redis.zscore(REDIS_ACTIVITY_KEY, sandboxId);
		if (score !== null) {
			return new Date(Number(score));
		}

		const row = await this.entityManager.findOne(SandboxLastActivity, {
			sandbox: sandboxId,
		});

		return row?.lastActivityAt ?? null;
	}

	@LogExecution('flush-activity-to-db')
	async flushActivityToDb(): Promise<void> {
		await RequestContext.create(this.entityManager, () =>
			this.flushActivityToDbInContext()
		);
	}

	private async flushActivityToDbInContext(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			FLUSH_LOCK_KEY,
			FLUSH_LOCK_TTL_SECONDS,
			async () => {
				try {
					await this.flushActivity();
				} catch (error) {
					this.logger.error(
						'Error flushing activity timestamps to the database:',
						error
					);
				}
			}
		);
	}

	private async flushActivity(): Promise<void> {
		let totalFlushed = 0;

		const batchSize = SANDBOX_ACTIVITY_FLUSH_BATCH_SIZE;
		const maxScore = Date.now();

		const entries = await this.redis.zrangebyscore(
			REDIS_ACTIVITY_KEY,
			'-inf',
			maxScore,
			'WITHSCORES'
		);

		if (entries.length === 0) {
			return;
		}

		const updates: SandboxActivityUpdate[] = [];
		for (let i = 0; i < entries.length; i += 2) {
			updates.push({
				sandboxId: entries[i],
				lastActivityAt: new Date(Number(entries[i + 1])),
			});
		}

		for (let offset = 0; offset < updates.length; offset += batchSize) {
			const batch = updates.slice(offset, offset + batchSize);
			await this.bulkUpsertActivity(batch);
			totalFlushed += batch.length;
		}

		await this.redis.zremrangebyscore(REDIS_ACTIVITY_KEY, '-inf', maxScore);

		if (totalFlushed > 0) {
			this.logger.debug(
				`Flushed ${totalFlushed} activity timestamps to the database`
			);
		}
	}

	private async upsertActivity(
		values: readonly SandboxActivityUpdate[]
	): Promise<void> {
		const placeholders = values.map(() => '(?, ?)').join(', ');
		const parameters = values.flatMap(({ sandboxId, lastActivityAt }) => [
			sandboxId,
			lastActivityAt,
		]);
		await this.entityManager.execute(
			`INSERT INTO sandbox_last_activity ("sandboxId", "lastActivityAt")
			 VALUES ${placeholders}
			 ON CONFLICT ("sandboxId") DO UPDATE
			 SET "lastActivityAt" = EXCLUDED."lastActivityAt"
			 WHERE sandbox_last_activity."lastActivityAt" < EXCLUDED."lastActivityAt"`,
			parameters
		);
	}

	private async bulkUpsertActivity(
		updates: SandboxActivityUpdate[]
	): Promise<void> {
		if (updates.length === 0) {
			this.logger.debug('No activity updates to flush');
			return;
		}

		try {
			await this.upsertActivity(updates);
			return;
		} catch (error) {
			if (!(error instanceof ForeignKeyConstraintViolationException)) {
				throw error;
			}
		}
		this.logger.warn(
			'Bulk upsert for activity timestamps failed with FK violation, falling back to individual upserts'
		);
		for (const update of updates) {
			await this.upsertSingleActivity(update);
		}
	}

	private async upsertSingleActivity(
		update: SandboxActivityUpdate
	): Promise<void> {
		try {
			await this.upsertActivity([update]);
		} catch (error) {
			if (!(error instanceof ForeignKeyConstraintViolationException)) {
				throw error;
			}
			this.logger.warn(
				`Skipping activity flush for sandbox ${update.sandboxId} (deleted)`
			);
		}
	}
}
