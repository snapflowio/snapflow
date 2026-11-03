/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { setTimeout as sleep } from 'node:timers/promises';
import type { Logger, OnApplicationShutdown } from '@nestjs/common';
import type { TrackableJobExecutions } from '../../types/trackable-job-executions.types';

const JOB_SHUTDOWN_POLL_MILLISECONDS = 1_000;

export abstract class TrackedJobs
	implements TrackableJobExecutions, OnApplicationShutdown
{
	activeJobs = new Set<string>();
	protected abstract readonly logger: Logger;

	async onApplicationShutdown(): Promise<void> {
		while (this.activeJobs.size > 0) {
			this.logger.log(
				`Waiting for ${this.activeJobs.size} active jobs to finish`
			);
			await sleep(JOB_SHUTDOWN_POLL_MILLISECONDS);
		}
	}
}
