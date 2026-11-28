/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { USAGE_LOCK } from '../constants/usage-lifecycle.constants';

@Injectable()
export class UsageLockService {
	constructor(private readonly redisLockProvider: RedisLockProvider) {}

	async withSandboxLock(
		sandboxId: string,
		operation: () => Promise<void>
	): Promise<void> {
		const lease = await this.redisLockProvider.acquire(
			sandboxLockKey(sandboxId),
			USAGE_LOCK.TTL_SECONDS,
			USAGE_LOCK.WAIT_TIMEOUT_MILLISECONDS
		);
		try {
			await operation();
		} finally {
			await lease.release();
		}
	}

	async tryWithSandboxLock(
		sandboxId: string,
		operation: () => Promise<void>
	): Promise<void> {
		await this.redisLockProvider.runExclusive(
			sandboxLockKey(sandboxId),
			USAGE_LOCK.TTL_SECONDS,
			operation
		);
	}

	async tryWithJobLock(
		jobName: string,
		operation: () => Promise<void>
	): Promise<void> {
		await this.redisLockProvider.runExclusive(
			jobName,
			USAGE_LOCK.JOB_TTL_SECONDS,
			operation
		);
	}
}

function sandboxLockKey(sandboxId: string): string {
	return `${USAGE_LOCK.SANDBOX_KEY_PREFIX}${sandboxId}`;
}
