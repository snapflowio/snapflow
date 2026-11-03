/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes, randomInt } from 'node:crypto';
import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { BASIS_POINTS_SCALE } from '../../../common/constants/money.constants';
import { MILLISECONDS_PER_HOUR } from '../../../common/constants/time.constants';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { addMilliseconds } from '../../../common/utils/time.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { MachineTier } from '../../../marketplace/machine/enums/machine-tier.enum';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import type { SettingsSnapshot } from '../../../settings/platform/types/settings.types';
import { BENCHMARK_PROTOCOL } from '../constants/benchmark-policy.constants';
import { SPOT_CHECK } from '../constants/spot-check.constants';
import { MachineSpotCheck } from '../entities/machine-spot-check.entity';
import {
	findSpotCheckCandidates,
	organizationSpendSince,
} from '../queries/verification.query';

@Injectable()
export class SpotCheckSchedulerService extends TrackedJobs {
	protected readonly logger = new Logger(SpotCheckSchedulerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService
	) {
		super();
	}

	@TrackJobExecution()
	async schedule(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const settings = await this.settings.get();
			const now = await databaseNow(this.entityManager);
			if (await this.budgetReached(this.entityManager, settings, now)) return;
			const candidates = await findSpotCheckCandidates(
				this.entityManager,
				SPOT_CHECK.BATCH_SIZE
			);
			this.entityManager.persist(
				candidates.map(({ machineId, tier }) => {
					const check = new MachineSpotCheck();
					check.machineId = machineId;
					check.nonce = randomBytes(BENCHMARK_PROTOCOL.NONCE_BYTES).toString(
						'hex'
					);
					check.scheduledAt = addMilliseconds(
						now,
						this.jitteredIntervalMillis(tier, settings)
					);
					return check;
				})
			);
			await this.entityManager.flush();
		});
	}

	async budgetReached(
		manager: EntityManager,
		settings: SettingsSnapshot,
		now: Date
	): Promise<boolean> {
		if (!settings.spotCheckOrganizationId) return true;
		const monthStart = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth())
		);
		const spend = await organizationSpendSince(
			manager,
			settings.spotCheckOrganizationId,
			monthStart
		);
		return spend.atLeast(
			MicroUsd.fromCents(settings.spotCheckMonthlyBudgetCents)
		);
	}

	private jitteredIntervalMillis(
		tier: MachineTier,
		settings: SettingsSnapshot
	): number {
		const hours =
			tier === MachineTier.COMMUNITY
				? settings.spotCheckIntervalHoursCommunity
				: settings.spotCheckIntervalHoursVerified;
		const jitter = randomInt(
			SPOT_CHECK.INTERVAL_MINIMUM_BASIS_POINTS,
			SPOT_CHECK.INTERVAL_MAXIMUM_BASIS_POINTS + 1
		);
		return Math.round(
			(hours * MILLISECONDS_PER_HOUR * jitter) / BASIS_POINTS_SCALE
		);
	}
}
