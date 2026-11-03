/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { REDIS_LOCK } from '../constants/redis.constants';
import { RedisLease } from '../types/redis-lease.types';

@Injectable()
export class RedisLockProvider {
	constructor(@InjectRedis() private readonly redis: Redis) {}

	async acquire(
		key: string,
		ttlSeconds: number,
		timeoutMilliseconds?: number
	): Promise<RedisLease> {
		const deadline =
			timeoutMilliseconds === undefined
				? Number.POSITIVE_INFINITY
				: Date.now() + timeoutMilliseconds;
		for (;;) {
			const lease = await this.tryAcquire(key, ttlSeconds);
			if (lease) return lease;
			if (Date.now() >= deadline) {
				throw new Error(
					`Timed out after ${timeoutMilliseconds}ms waiting for lock '${key}'`
				);
			}
			await sleep(REDIS_LOCK.pollIntervalMilliseconds);
		}
	}

	async runExclusive<Result>(
		key: string,
		ttlSeconds: number,
		task: () => Promise<Result>
	): Promise<Result | undefined> {
		const lease = await this.tryAcquire(key, ttlSeconds);
		if (!lease) return undefined;
		try {
			return await task();
		} finally {
			await lease.release();
		}
	}

	async claim(key: string, ttlSeconds: number): Promise<boolean> {
		const claimed = await this.redis.set(
			key,
			REDIS_LOCK.claimValue,
			'EX',
			ttlSeconds,
			'NX'
		);
		return claimed !== null;
	}

	async isLocked(key: string): Promise<boolean> {
		return (await this.redis.exists(key)) === 1;
	}

	private async tryAcquire(
		key: string,
		ttlSeconds: number
	): Promise<RedisLease | null> {
		const owner = randomUUID();
		const acquired = await this.redis.set(key, owner, 'EX', ttlSeconds, 'NX');
		if (acquired === null) return null;
		return {
			release: async () => {
				await this.redis.eval(REDIS_LOCK.releaseOwnedScript, 1, key, owner);
			},
		};
	}
}
