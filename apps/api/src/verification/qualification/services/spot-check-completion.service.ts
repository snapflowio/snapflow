/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { BenchmarkMeasurementsSchema } from '@snapflow/machine-proto';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SandboxLifecycleService } from '../../../sandbox/instance/services/lifecycle/sandbox-lifecycle.service';
import { protoJsonObject } from '../../../sandbox/machine/utils/proto/proto-json.util';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import { MachineSpotCheck } from '../entities/machine-spot-check.entity';
import { SpotCheckState } from '../enums/spot-check-state.enum';
import type { SpotCheckOutcome } from '../utils/spot-check-outcome.util';
import { SpotCheckFailureService } from './spot-check-failure.service';

@Injectable()
export class SpotCheckCompletionService {
	private readonly logger = new Logger(SpotCheckCompletionService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly failures: SpotCheckFailureService,
		private readonly lifecycle: SandboxLifecycleService
	) {}

	async finish(
		check: MachineSpotCheck,
		outcome: SpotCheckOutcome
	): Promise<void> {
		await this.entityManager.transactional(async (manager) => {
			const current = await manager.findOneOrFail(
				MachineSpotCheck,
				{ id: check.id },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			const now = await databaseNow(manager);
			current.state = outcome.state;
			current.completedAt = now;
			current.failureReasons =
				outcome.state === SpotCheckState.PASSED ? [] : [...outcome.reasons];
			current.measurements =
				outcome.state === SpotCheckState.ABORTED
					? null
					: protoJsonObject(BenchmarkMeasurementsSchema, outcome.measurements);
			if (outcome.state === SpotCheckState.FAILED) {
				await this.failures.handle(manager, current, now);
			}
			await manager.flush();
		});
		await this.destroySandbox(check);
	}

	private async destroySandbox(check: MachineSpotCheck): Promise<void> {
		const organizationId = (await this.settings.get()).spotCheckOrganizationId;
		if (!check.sandboxId || !organizationId) return;
		try {
			await this.lifecycle.destroy(check.sandboxId, organizationId);
		} catch (error) {
			this.logger.warn(
				`Spot check sandbox ${check.sandboxId} could not be destroyed`,
				error
			);
		}
	}
}
