/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { SettingsService } from '../../settings/services/settings.service';
import { SPOT_CHECK } from '../constants/spot-check.constants';
import { MachineSpotCheck } from '../entities/machine-spot-check.entity';
import { SpotCheckState } from '../enums/spot-check-state.enum';
import { SpotCheckLaunchService } from './spot-check-launch.service';
import { SpotCheckRunService } from './spot-check-run.service';
import { SpotCheckSchedulerService } from './spot-check-scheduler.service';

@Injectable()
export class SpotCheckExecutorService extends TrackedJobs {
	protected readonly logger = new Logger(SpotCheckExecutorService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly scheduler: SpotCheckSchedulerService,
		private readonly launches: SpotCheckLaunchService,
		private readonly runs: SpotCheckRunService,
		private readonly locks: RedisLockProvider
	) {
		super();
	}

	@TrackJobExecution()
	async execute(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const settings = await this.settings.get();
			const now = await databaseNow(this.entityManager);
			if (
				!(await this.scheduler.budgetReached(this.entityManager, settings, now))
			) {
				await this.launches.launchDue(settings, now);
			}
			const running = await this.entityManager.find(
				MachineSpotCheck,
				{ state: SpotCheckState.RUNNING },
				{ orderBy: { startedAt: 'ASC' }, limit: SPOT_CHECK.BATCH_SIZE }
			);
			for (const check of running) {
				await this.locks.runExclusive(
					`${SPOT_CHECK.LOCK_KEY_PREFIX}${check.id}`,
					SPOT_CHECK.LOCK_TTL_SECONDS,
					() => this.runs.progress(check.id, settings)
				);
			}
		});
	}
}
