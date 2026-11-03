/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Job } from '../entities/job.entity';
import { JobProjectionStatus } from '../enums/job-projection-status.enum';
import { JobStatus } from '../enums/job-status.enum';

export type AbandonedJobLeaseTransition = 'requeued' | 'failed';

export function abandonJobLease(
	job: Job,
	now: Date,
	failureMessage: string
): AbandonedJobLeaseTransition {
	job.leaseToken = null;
	job.leaseExpiresAt = null;
	job.leasedBySessionId = null;
	if (job.attempt < job.maxAttempts) {
		job.status = JobStatus.PENDING;
		job.availableAt = now;
		job.completedAt = null;
		job.errorMessage = null;
		return 'requeued';
	}

	job.status = JobStatus.FAILED;
	job.completedAt = now;
	job.errorMessage = failureMessage;
	job.projectionStatus = JobProjectionStatus.PENDING;
	return 'failed';
}
