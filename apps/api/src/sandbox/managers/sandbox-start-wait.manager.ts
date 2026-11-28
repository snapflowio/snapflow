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
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import {
	SANDBOX_PRICE_BATCH_SIZE,
	SANDBOX_PRICE_JOB,
} from '../constants/sandbox-placement.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxStartWaitService } from '../services/lifecycle/sandbox-start-wait.service';

@Injectable()
export class SandboxStartWaitManager extends TrackedJobs {
	protected readonly logger = new Logger(SandboxStartWaitManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly startWaits: SandboxStartWaitService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(SANDBOX_PRICE_JOB.START_WAIT)
	@CreateRequestContext()
	async settleStartWaits(): Promise<void> {
		const now = await databaseNow(this.entityManager);
		const waiting = await this.entityManager.find(
			Sandbox,
			{ startWaitUntil: { $ne: null } },
			{ limit: SANDBOX_PRICE_BATCH_SIZE, orderBy: { startWaitUntil: 'ASC' } }
		);
		await settleSequentially(waiting, (sandbox) =>
			this.startWaits
				.settle(sandbox, now)
				.catch((error: unknown) =>
					this.logger.error(
						`Could not settle the start wait of sandbox ${sandbox.id}`,
						error
					)
				)
		);
	}
}
