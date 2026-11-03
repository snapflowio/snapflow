/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import {
	USAGE_ARCHIVE_BATCH_SIZE,
	USAGE_JOB,
} from '../constants/usage-lifecycle.constants';
import { SandboxUsagePeriod } from '../entities/sandbox-usage-period.entity';
import { SandboxUsagePeriodArchive } from '../entities/sandbox-usage-period-archive.entity';
import { UsageLockService } from './usage-lock.service';

@Injectable()
export class UsageArchiveService extends TrackedJobs {
	protected readonly logger = new Logger(UsageArchiveService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly locks: UsageLockService
	) {
		super();
	}

	@TrackJobExecution()
	@LogExecution(USAGE_JOB.ARCHIVE)
	async archiveUsagePeriods(): Promise<void> {
		await RequestContext.create(this.entityManager, () =>
			this.locks.tryWithJobLock(USAGE_JOB.ARCHIVE, () => this.archiveBatch())
		);
	}

	private async archiveBatch(): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const usagePeriods = await manager.find(
					SandboxUsagePeriod,
					{ endAt: { $ne: null } },
					{ orderBy: { startAt: 'ASC' }, limit: USAGE_ARCHIVE_BATCH_SIZE }
				);
				if (usagePeriods.length === 0) return;
				this.logger.debug(
					`Found ${usagePeriods.length} usage periods to archive`
				);
				manager.persist(
					usagePeriods.map(SandboxUsagePeriodArchive.fromUsagePeriod)
				);
				manager.remove(usagePeriods);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}
}
