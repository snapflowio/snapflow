/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	LockMode,
	RequestContext,
	TransactionPropagation,
} from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { BILLING_POLICY } from '../../../billing/ledger/constants/billing-policy.constants';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SandboxLease } from '../../../marketplace/machine/entities/sandbox-lease.entity';
import { Sandbox } from '../../../sandbox/instance/entities/sandbox.entity';
import {
	USAGE_JOB,
	USAGE_WINDOW_BATCH_SIZE,
} from '../constants/usage-lifecycle.constants';
import { SandboxUsagePeriod } from '../entities/sandbox-usage-period.entity';
import { sandboxUsageMode } from '../utils/usage-mode.util';
import { UsageLockService } from './usage-lock.service';
import { UsagePeriodService } from './usage-period.service';

@Injectable()
export class UsageWindowRotationService extends TrackedJobs {
	protected readonly logger = new Logger(UsageWindowRotationService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly locks: UsageLockService,
		private readonly periods: UsagePeriodService
	) {
		super();
	}

	@TrackJobExecution()
	@LogExecution(USAGE_JOB.WINDOW_ROTATION)
	async closeAndReopenUsagePeriods(): Promise<void> {
		await RequestContext.create(this.entityManager, () =>
			this.locks.tryWithJobLock(USAGE_JOB.WINDOW_ROTATION, () =>
				this.rotateExpiredPeriods()
			)
		);
	}

	private async rotateExpiredPeriods(): Promise<void> {
		const windowMilliseconds =
			BILLING_POLICY.accountingWindowMinutes * MILLISECONDS_PER_MINUTE;
		const observedAt = await databaseNow(this.entityManager);
		const currentWindowStartedAt = new Date(
			Math.floor(observedAt.getTime() / windowMilliseconds) * windowMilliseconds
		);
		const usagePeriods = await this.entityManager.execute<
			{ id: string; sandboxId: string }[]
		>(
			`SELECT period.id, period."sandboxId"
			 FROM sandbox_usage_periods period
			 JOIN sandbox_lease lease ON lease.id = period."leaseId"
			 WHERE period."endAt" IS NULL
			   AND (period."startAt" < ? OR lease."endedAt" IS NOT NULL)
			 ORDER BY period."startAt" ASC
			 LIMIT ?`,
			[currentWindowStartedAt, USAGE_WINDOW_BATCH_SIZE]
		);
		for (const usagePeriod of usagePeriods) {
			try {
				await this.locks.tryWithSandboxLock(usagePeriod.sandboxId, () =>
					this.rotate(usagePeriod.id, windowMilliseconds)
				);
			} catch (error) {
				this.logger.error(
					`Error closing and reopening usage period ${usagePeriod.id}`,
					error
				);
			}
		}
	}

	private async rotate(
		usagePeriodId: string,
		windowMilliseconds: number
	): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const current = await manager.findOne(
					SandboxUsagePeriod,
					{ id: usagePeriodId, endAt: null },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!current) return;
				const sandbox = await manager.findOne(
					Sandbox,
					{ id: current.sandboxId },
					{ lockMode: LockMode.PESSIMISTIC_READ }
				);
				const lease = await manager.findOneOrFail(SandboxLease, {
					id: current.leaseId,
				});
				const windowEnd = rotationBoundary(
					current.startAt,
					lease.endedAt,
					windowMilliseconds
				);
				await this.periods.close(manager, current, windowEnd);
				const usageMode = sandboxUsageMode(sandbox);
				if (sandbox && usageMode !== null) {
					await this.periods.open(manager, sandbox, usageMode, windowEnd);
				}
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}
}

function rotationBoundary(
	startedAt: Date,
	leaseEndedAt: Date | null,
	windowMilliseconds: number
): Date {
	const windowEnd = utcWindowEnd(startedAt, windowMilliseconds);
	return leaseEndedAt && leaseEndedAt < windowEnd
		? new Date(Math.max(leaseEndedAt.getTime(), startedAt.getTime()))
		: windowEnd;
}

function utcWindowEnd(startedAt: Date, windowMilliseconds: number): Date {
	return new Date(
		(Math.floor(startedAt.getTime() / windowMilliseconds) + 1) *
			windowMilliseconds
	);
}
