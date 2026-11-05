/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { IsolatedEntityManagerContext } from '../../common/decorators/isolated-entity-manager-context.decorator';
import { OnAsyncEvent } from '../../common/decorators/on-async-event.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { mapSequentially } from '../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SnapshotEvents } from '../snapshot/constants/snapshot-events.constants';
import type { SnapshotBuildSettledEvent } from '../snapshot/events/snapshot-build-settled.event';
import { SandboxManager } from './sandbox.manager';

@Injectable()
export class SandboxBuildWakeListener extends TrackedJobs {
	protected readonly logger = new Logger(SandboxBuildWakeListener.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxManager: SandboxManager
	) {
		super();
	}

	@OnAsyncEvent({ event: SnapshotEvents.BUILD_SETTLED })
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	async handleBuildSettled(event: SnapshotBuildSettledEvent): Promise<void> {
		const sandboxes = await this.entityManager.find(
			Sandbox,
			{
				machineId: event.machineId,
				state: SandboxState.BUILDING_SNAPSHOT,
				buildInfo: { snapshotRef: { $in: [...event.snapshotRefs] } },
			},
			{ fields: ['id'] }
		);
		await mapSequentially(sandboxes, ({ id }) =>
			this.sandboxManager.syncInstanceState(id)
		);
	}
}
