/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FilterQuery } from '@mikro-orm/core';
import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import {
	MILLISECONDS_PER_DAY,
	MILLISECONDS_PER_HOUR,
} from '../../common/constants/time.constants';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { addMilliseconds } from '../../common/utils/time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';

const CLEANUP_LOCK_TTL_SECONDS = 300;
const DESTROYED_BUILD_FAILED_RETENTION_HOURS = 24;
const STALE_SANDBOX_RETENTION_DAYS = 7;

@Injectable()
export class SandboxCleanupManager {
	private readonly logger = new Logger(SandboxCleanupManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly redisLockProvider: RedisLockProvider
	) {}

	get em(): EntityManager {
		return this.entityManager;
	}

	@LogExecution('cleanup-build-failed-sandboxes')
	@CreateRequestContext()
	async cleanupBuildFailedSandboxes(): Promise<void> {
		const cutoff = addMilliseconds(
			new Date(),
			-DESTROYED_BUILD_FAILED_RETENTION_HOURS * MILLISECONDS_PER_HOUR
		);
		await this.purge(
			'sandbox:cleanup-build-failed-sandboxes',
			{
				state: SandboxState.BUILD_FAILED,
				desiredState: SandboxDesiredState.DESTROYED,
				updatedAt: { $lt: cutoff },
			},
			'build failed sandboxes'
		);
	}

	@LogExecution('cleanup-stale-build-failed-sandboxes')
	@CreateRequestContext()
	async cleanupStaleBuildFailedSandboxes(): Promise<void> {
		await this.purge(
			'sandbox:cleanup-stale-build-failed-sandboxes',
			{
				state: SandboxState.BUILD_FAILED,
				desiredState: SandboxDesiredState.STARTED,
				updatedAt: { $lt: staleCutoff() },
			},
			'stale build failed sandboxes'
		);
	}

	@LogExecution('cleanup-stale-error-sandboxes')
	@CreateRequestContext()
	async cleanupStaleErrorSandboxes(): Promise<void> {
		await this.purge(
			'sandbox:cleanup-stale-error-sandboxes',
			{
				state: SandboxState.ERROR,
				desiredState: SandboxDesiredState.DESTROYED,
				updatedAt: { $lt: staleCutoff() },
			},
			'stale error sandboxes'
		);
	}

	private async purge(
		lockKey: string,
		where: FilterQuery<Sandbox>,
		description: string
	): Promise<void> {
		await this.redisLockProvider.runExclusive(
			lockKey,
			CLEANUP_LOCK_TTL_SECONDS,
			async () => {
				const deleted = await this.entityManager.nativeDelete(Sandbox, where);
				if (deleted > 0) {
					this.logger.debug(`Cleaned up ${deleted} ${description}`);
				}
			}
		);
	}
}

function staleCutoff(): Date {
	return addMilliseconds(
		new Date(),
		-STALE_SANDBOX_RETENTION_DAYS * MILLISECONDS_PER_DAY
	);
}
