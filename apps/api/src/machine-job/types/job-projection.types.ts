/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Job } from '../entities/job.entity';
import type { JobType } from '../enums/job-type.enum';

export type JobProjection = (job: Job) => Promise<void>;

export interface JobTypeProjector {
	readonly projections: ReadonlyMap<JobType, JobProjection>;
}
