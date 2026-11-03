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
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import {
	SANDBOX_LEASE_BATCH_SIZE,
	SANDBOX_LEASE_JOB,
} from '../constants/sandbox-placement.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SandboxRepository } from '../repositories/sandbox.repository';

const WAITING_STATES: readonly SandboxState[] = [
	SandboxState.STOPPED,
	SandboxState.ARCHIVED,
];

@Injectable()
export class PinnedStartWaitManager extends TrackedJobs {
	protected readonly logger = new Logger(PinnedStartWaitManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(SANDBOX_LEASE_JOB.PINNED_START_WAIT)
	@CreateRequestContext()
	async settleStartWaits(): Promise<void> {
		const now = await databaseNow(this.entityManager);
		const waiting = await this.entityManager.find(
			Sandbox,
			{ startWaitUntil: { $ne: null } },
			{ limit: SANDBOX_LEASE_BATCH_SIZE, orderBy: { startWaitUntil: 'ASC' } }
		);
		await settleSequentially(waiting, (sandbox) =>
			this.settle(sandbox, now).catch((error: unknown) =>
				this.logger.error(
					`Could not settle the pinned start wait of sandbox ${sandbox.id}`,
					error
				)
			)
		);
	}

	private async settle(sandbox: Sandbox, now: Date): Promise<void> {
		const waiting =
			sandbox.desiredState === SandboxDesiredState.STARTED &&
			WAITING_STATES.includes(sandbox.state);
		if (waiting && sandbox.startWaitUntil && sandbox.startWaitUntil > now) {
			return;
		}
		await this.sandboxRepository.updateWhere(sandbox.id, {
			updateData: waiting
				? {
						startWaitUntil: null,
						pending: false,
						desiredState:
							sandbox.state === SandboxState.ARCHIVED
								? SandboxDesiredState.ARCHIVED
								: SandboxDesiredState.STOPPED,
					}
				: { startWaitUntil: null },
			whereCondition: { state: sandbox.state },
		});
	}
}
