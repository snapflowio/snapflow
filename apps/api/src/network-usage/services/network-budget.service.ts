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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 } from 'uuid';
import { BillingBudget } from '../../billing/entities/billing-budget.entity';
import { monthSpend } from '../../billing/queries/billing-admission.query';
import { utcBillingMonth } from '../../billing/utils/billing-period.util';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { NetworkingEvents } from '../../networking/constants/networking-events.constants';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { SandboxRuntimeOperationService } from '../../sandbox/services/sandbox/sandbox-runtime-operation.service';
import { SettingsService } from '../../settings/services/settings.service';
import { NETWORK_BUDGET } from '../constants/network-usage.constants';
import { NetworkBudgetThresholdReachedEvent } from '../events/network-budget-threshold-reached.event';
import {
	networkBudgetExhausted,
	reachedBudgetThresholds,
} from '../utils/network-budget.util';

const THROTTLE_CHANGES_SQL = `SELECT sandbox.id,
		CASE WHEN sandbox."organizationId" = ANY(ARRAY[?]::uuid[]) THEN ?::double precision END AS cap
	FROM sandbox
	WHERE sandbox.state = ? AND sandbox.pending = false
		AND (CASE WHEN sandbox."organizationId" = ANY(ARRAY[?]::uuid[]) THEN ?::double precision END)
			IS DISTINCT FROM sandbox."networkThrottleBandwidthBps"
	ORDER BY sandbox.id
	LIMIT ?`;

const INSERT_ALERT_SQL = `INSERT INTO network_budget_alert
		(id, "organizationId", "monthStart", "thresholdBasisPoints", "spendMicroUsd", "limitMicroUsd")
	VALUES (?, ?, ?, ?, ?, ?)
	ON CONFLICT ("organizationId", "monthStart", "thresholdBasisPoints") DO NOTHING
	RETURNING id`;

@Injectable()
export class NetworkBudgetService extends TrackedJobs {
	protected readonly logger = new Logger(NetworkBudgetService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly runtimeOperations: SandboxRuntimeOperationService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly eventEmitter: EventEmitter2
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(NETWORK_BUDGET.JOB)
	@CreateRequestContext()
	async enforce(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			NETWORK_BUDGET.JOB,
			NETWORK_BUDGET.LOCK_TTL_SECONDS,
			async () => {
				const monthStart = utcBillingMonth(
					await databaseNow(this.entityManager)
				).start;
				const exhausted = await this.alert(monthStart);
				await this.throttle(exhausted);
			}
		);
	}

	private async alert(monthStart: Date): Promise<string[]> {
		const budgets = await this.entityManager.find(BillingBudget, {
			networkLimitMicroUsd: { $ne: null },
		});
		const exhausted: string[] = [];
		for (const budget of budgets) {
			const limit = MicroUsd.parseNullable(budget.networkLimitMicroUsd);
			if (limit === null) continue;
			const spend = (
				await monthSpend(this.entityManager, budget.organizationId, monthStart)
			).networkMicroUsd;
			const throttled = networkBudgetExhausted(spend, limit);
			if (throttled) exhausted.push(budget.organizationId);
			for (const threshold of reachedBudgetThresholds(spend, limit)) {
				const inserted = await this.entityManager.execute<{ id: string }[]>(
					INSERT_ALERT_SQL,
					[
						v4(),
						budget.organizationId,
						monthStart,
						threshold,
						spend.toString(),
						limit.toString(),
					]
				);
				if (inserted.length > 0) {
					this.eventEmitter.emit(
						NetworkingEvents.NETWORK_BUDGET_THRESHOLD_REACHED,
						new NetworkBudgetThresholdReachedEvent(
							budget.organizationId,
							threshold,
							spend.toString(),
							limit.toString(),
							throttled
						)
					);
				}
			}
		}
		return exhausted;
	}

	private async throttle(exhaustedOrganizationIds: string[]): Promise<void> {
		const settings = await this.settings.get();
		const changes = await this.entityManager.execute<
			{ id: string; cap: number | null }[]
		>(THROTTLE_CHANGES_SQL, [
			exhaustedOrganizationIds,
			settings.networkBudgetThrottleBandwidthBps,
			SandboxState.STARTED,
			exhaustedOrganizationIds,
			settings.networkBudgetThrottleBandwidthBps,
			NETWORK_BUDGET.BATCH_SIZE,
		]);
		await settleSequentially(changes, ({ id, cap }) =>
			this.runtimeOperations
				.applyNetworkThrottle(id, cap)
				.catch((error: unknown) =>
					this.logger.error(
						`Could not apply the network budget throttle to sandbox ${id}`,
						error
					)
				)
		);
	}
}
