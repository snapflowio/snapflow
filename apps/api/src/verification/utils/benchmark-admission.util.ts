/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Job } from '../../machine-job/entities/job.entity';
import { JobErrorCode } from '../../machine-job/enums/job-error-code.enum';
import { JobStatus } from '../../machine-job/enums/job-status.enum';

export function benchmarkNotAdmitted(
	job: Pick<Job, 'status' | 'executionResult'>
): boolean {
	return (
		job.status === JobStatus.FAILED &&
		job.executionResult?.errorCode === JobErrorCode.INSUFFICIENT_CAPACITY
	);
}
