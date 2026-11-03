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
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { Sandbox } from '../../../sandbox/instance/entities/sandbox.entity';
import { SandboxPlacement } from '../../../sandbox/instance/entities/sandbox-placement.entity';
import { SandboxDesiredState } from '../../../sandbox/instance/enums/sandbox-desired-state.enum';
import {
	DISK_ONLY_USAGE_STATES,
	FULL_USAGE_STATES,
	METERED_USAGE_STATES,
	USAGE_LIFECYCLE_RECONCILIATION,
	UsageMode,
} from '../constants/usage-lifecycle.constants';
import type { SandboxUsagePeriod } from '../entities/sandbox-usage-period.entity';
import { sandboxUsageMode } from '../utils/usage-mode.util';
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
		const meteredPlaceholders = placeholders(METERED_USAGE_STATES);
		const missingPeriods = await this.entityManager.execute<
			DriftedSandboxRow[]
		>(
			`SELECT sandbox.id AS "sandboxId"
			 FROM "sandbox" sandbox
			 LEFT JOIN "sandbox_usage_periods" period
				ON period."sandboxId" = sandbox.id AND period."endAt" IS NULL
			 WHERE sandbox.state IN (${meteredPlaceholders})
			   AND sandbox."desiredState" <> ?
			   AND sandbox."machineId" IS NOT NULL
			   AND period.id IS NULL
			 LIMIT ?`,
			[
				...METERED_USAGE_STATES,
				SandboxDesiredState.DESTROYED,
				USAGE_LIFECYCLE_RECONCILIATION.BATCH_SIZE,
			]
		);
		const remaining =
			USAGE_LIFECYCLE_RECONCILIATION.BATCH_SIZE - missingPeriods.length;
		if (remaining === 0) {
			return missingPeriods.map(({ sandboxId }) => sandboxId);
		}
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
				OR sandbox."machineId" IS NULL
				OR sandbox."desiredState" = ?
				OR sandbox.state NOT IN (${meteredPlaceholders})
				OR period."machineId" <> sandbox."machineId"
				OR placement.id IS NULL
				OR period."placementId" <> placement.id
				OR (
					sandbox.state IN (${placeholders(FULL_USAGE_STATES)})
					AND (period.cpu <> sandbox.cpu OR period.mem <> sandbox.mem OR period.disk <> sandbox.disk OR period.gpu <> sandbox.gpu)
				)
				OR (
					sandbox.state IN (${placeholders(DISK_ONLY_USAGE_STATES)})
					AND (period.cpu <> 0 OR period.mem <> 0 OR period.gpu <> 0 OR period.disk <> sandbox.disk)
				)
			   )
			 LIMIT ?`,
			[
				SandboxDesiredState.DESTROYED,
				...METERED_USAGE_STATES,
				...FULL_USAGE_STATES,
				...DISK_ONLY_USAGE_STATES,
				remaining,
			]
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
		const period = await this.periods.lockOpen(manager, sandboxId);
		const usageMode = sandboxUsageMode(sandbox);
		const boundary = await databaseNow(manager);
		if (!sandbox || usageMode === null) {
			if (period) await this.periods.close(manager, period, boundary);
			return;
		}
		if (period) {
			if (await this.periodCurrent(manager, period, sandbox, usageMode)) {
				return;
			}
			await this.periods.close(manager, period, boundary);
		}
		await this.periods.open(manager, sandbox, usageMode, boundary);
	}

	private async periodCurrent(
		manager: EntityManager,
		period: SandboxUsagePeriod,
		sandbox: Sandbox,
		usageMode: UsageMode
	): Promise<boolean> {
		const placement = await manager.findOne(
			SandboxPlacement,
			{ sandboxId: sandbox.id, releasedAt: null },
			{ lockMode: LockMode.PESSIMISTIC_READ }
		);
		return (
			placement !== null && periodMatches(period, sandbox, placement, usageMode)
		);
	}
}

function periodMatches(
	period: SandboxUsagePeriod,
	sandbox: Sandbox,
	placement: SandboxPlacement,
	usageMode: UsageMode
): boolean {
	const resourcesMatch =
		usageMode === UsageMode.FULL
			? period.cpu === sandbox.cpu &&
				period.mem === sandbox.mem &&
				period.gpu === sandbox.gpu
			: period.cpu === 0 && period.mem === 0 && period.gpu === 0;
	return (
		placement.machineId === sandbox.machineId &&
		period.machineId === sandbox.machineId &&
		period.placementId === placement.id &&
		period.assignmentGeneration === placement.assignmentGeneration &&
		period.disk === sandbox.disk &&
		resourcesMatch
	);
}

function placeholders(values: readonly unknown[]): string {
	return values.map(() => '?').join(', ');
}
