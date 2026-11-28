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
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import {
	USAGE_LIFECYCLE_RECONCILIATION,
	UsageMode,
} from '../constants/usage-lifecycle.constants';
import { sandboxUsageMode, usageModeSql } from '../utils/usage-mode.util';
import { UsageLockService } from './usage-lock.service';
import { UsagePeriodService } from './usage-period.service';

interface DriftedSandboxRow {
	sandboxId: string;
}

@Injectable()
export class UsageDriftReconcilerService extends TrackedJobs {
	protected readonly logger = new Logger(UsageDriftReconcilerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly locks: UsageLockService,
		private readonly periods: UsagePeriodService
	) {
		super();
	}

	@TrackJobExecution()
	async reconcileUsageLifecycle(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			for (
				let batch = 0;
				batch < USAGE_LIFECYCLE_RECONCILIATION.MAXIMUM_BATCHES;
				batch += 1
			) {
				const sandboxIds = await this.findDriftedSandboxes();
				await this.reconcileBatch(sandboxIds);
				if (sandboxIds.length < USAGE_LIFECYCLE_RECONCILIATION.BATCH_SIZE) {
					return;
				}
			}
			this.logger.warn(
				'Usage lifecycle reconciliation reached its per-run batch limit'
			);
		});
	}

	private async reconcileBatch(sandboxIds: readonly string[]): Promise<void> {
		for (const sandboxId of sandboxIds) {
			try {
				await this.locks.tryWithSandboxLock(sandboxId, () =>
					this.reconcileSandbox(sandboxId)
				);
			} catch (error) {
				this.logger.error(
					`Failed to reconcile usage lifecycle for sandbox ${sandboxId}`,
					error
				);
			}
		}
	}

	private async findDriftedSandboxes(): Promise<string[]> {
		const missingMode = usageModeSql('sandbox');
		const missingPeriods = await this.entityManager.execute<
			DriftedSandboxRow[]
		>(
			`SELECT sandbox.id AS "sandboxId"
			 FROM "sandbox" sandbox
			 LEFT JOIN "sandbox_usage_periods" period
				ON period."sandboxId" = sandbox.id AND period."endAt" IS NULL
			 WHERE ${missingMode.sql} IS NOT NULL
			   AND period.id IS NULL
			 LIMIT ?`,
			[...missingMode.bindings, USAGE_LIFECYCLE_RECONCILIATION.BATCH_SIZE]
		);
		const remaining =
			USAGE_LIFECYCLE_RECONCILIATION.BATCH_SIZE - missingPeriods.length;
		if (remaining === 0) {
			return missingPeriods.map(({ sandboxId }) => sandboxId);
		}
		const currentMode = usageModeSql('sandbox');
		const driftedPeriods = await this.entityManager.execute<
			DriftedSandboxRow[]
		>(
			`SELECT period."sandboxId" AS "sandboxId"
			 FROM "sandbox_usage_periods" period
			 LEFT JOIN "sandbox" sandbox ON sandbox.id = period."sandboxId"
			 LEFT JOIN "sandbox_placement" placement
				ON placement."sandboxId" = period."sandboxId" AND placement."releasedAt" IS NULL
			 WHERE period."endAt" IS NULL
			   AND (
				sandbox.id IS NULL
				OR ${currentMode.sql} IS DISTINCT FROM period.mode::text
				OR period."machineId" <> sandbox."machineId"
				OR placement.id IS NULL
				OR period."placementId" <> placement.id
				OR period.disk <> sandbox.disk
				OR (
					period.mode = ?
					AND (period.cpu <> sandbox.cpu OR period.mem <> sandbox.mem OR period.gpu <> sandbox.gpu)
				)
				OR (
					period.mode = ?
					AND (period.cpu <> 0 OR period.mem <> 0 OR period.gpu <> 0)
				)
			   )
			 LIMIT ?`,
			[...currentMode.bindings, UsageMode.FULL, UsageMode.DISK, remaining]
		);
		return [
			...new Set(
				[...missingPeriods, ...driftedPeriods].map(({ sandboxId }) => sandboxId)
			),
		];
	}

	private async reconcileSandbox(sandboxId: string): Promise<void> {
		await this.entityManager.transactional(
			(manager) => this.reconcileLocked(manager, sandboxId),
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async reconcileLocked(
		manager: EntityManager,
		sandboxId: string
	): Promise<void> {
		const sandbox = await manager.findOne(
			Sandbox,
			{ id: sandboxId },
			{ lockMode: LockMode.PESSIMISTIC_READ }
		);
		if (sandbox) {
			await this.periods.transition(
				sandbox,
				sandboxUsageMode(sandbox),
				manager
			);
			return;
		}
		const period = await this.periods.lockOpen(manager, sandboxId);
		if (period) {
			await this.periods.close(manager, period, await databaseNow(manager));
		}
	}
}
