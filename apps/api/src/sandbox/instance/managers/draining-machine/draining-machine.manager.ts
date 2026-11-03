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
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { LogExecution } from '../../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../../common/utils/concurrency/tracked-jobs.util';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { DrainingMode } from '../../../../settings/platform/constants/settings.constants';
import { SettingsService } from '../../../../settings/platform/services/settings.service';
import type { Machine } from '../../../machine/entities/machine.entity';
import { MachineService } from '../../../machine/services/machine.service';
import { SANDBOX_WORKER_LIMITS } from '../../constants/sandbox.constants';
import { DrainingMachineEvictionService } from '../../services/draining-machine/draining-machine-eviction.service';
import { DrainingMachineRecoveryService } from '../../services/draining-machine/draining-machine-recovery.service';

const DRAINING_MACHINE_CURSOR_KEY = 'draining-machine-sandboxes-cursor';
const DRAINING_MACHINE_LOCK_KEY = 'draining-machine-sandboxes-check';
const DRAINING_MACHINE_LOCK_TTL_SECONDS = 10 * 60;

@Injectable()
export class DrainingMachineManager extends TrackedJobs {
	protected readonly logger = new Logger(DrainingMachineManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineService: MachineService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly settings: SettingsService,
		private readonly eviction: DrainingMachineEvictionService,
		private readonly recovery: DrainingMachineRecoveryService,
		@InjectRedis() private readonly redis: Redis
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution('draining-machine-sandboxes-check')
	@CreateRequestContext()
	async drainingMachineSandboxesCheck(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			DRAINING_MACHINE_LOCK_KEY,
			DRAINING_MACHINE_LOCK_TTL_SECONDS,
			async () => {
				const drainingMachines = await this.nextDrainingMachines();
				const { drainingMode, drainingForce } = await this.settings.get();

				await settleSequentially(drainingMachines, async (machine) => {
					try {
						if (drainingForce) {
							await this.eviction.forceStopStartedSandboxes(machine.id);
						}
						if (drainingMode === DrainingMode.ARCHIVE) {
							await this.eviction.archiveStoppedSandboxes(machine.id);
						} else {
							await this.eviction.migrateStoppedSandboxes(machine);
						}
						await this.eviction.archiveErroredSandboxes(machine.id);
						await this.recovery.recoverRecoverableSandboxes(machine);
						await this.recovery.retryErroredBackups(machine.id);
					} catch (error) {
						this.logger.error(
							`Error processing draining machine ${machine.id} for sandbox migration`,
							error
						);
					}
				});
			}
		);
	}

	private async nextDrainingMachines(): Promise<Machine[]> {
		const cursor = await this.redis.get(DRAINING_MACHINE_CURSOR_KEY);
		let drainingMachines = await this.machineService.findDrainingPage(
			cursor,
			SANDBOX_WORKER_LIMITS.drainingMachineBatchSize
		);
		if (drainingMachines.length === 0 && cursor) {
			drainingMachines = await this.machineService.findDrainingPage(
				null,
				SANDBOX_WORKER_LIMITS.drainingMachineBatchSize
			);
		}
		const nextCursor = drainingMachines.at(-1)?.id;
		if (nextCursor) {
			await this.redis.set(DRAINING_MACHINE_CURSOR_KEY, nextCursor);
		} else {
			await this.redis.del(DRAINING_MACHINE_CURSOR_KEY);
		}
		return drainingMachines;
	}
}
