/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException, ForbiddenException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import type { Job } from '../entities/job.entity';
import { JobStatus } from '../enums/job-status.enum';
import { MachineJobApiErrorCode } from '../enums/machine-job-api-error-code.enum';
import { JOB_NOT_OWNED_MESSAGE } from './job-error.util';

export function assertActiveLease(
	job: Job,
	machineId: string,
	leaseToken: string,
	attempt: number,
	now: Date
): void {
	if (job.machineId !== machineId) {
		throw new ForbiddenException(
			apiError(MachineJobApiErrorCode.NOT_OWNED, JOB_NOT_OWNED_MESSAGE)
		);
	}
	if (
		job.status !== JobStatus.IN_PROGRESS ||
		job.leaseToken !== leaseToken ||
		job.attempt !== attempt
	) {
		throw new ConflictException(
			apiError(
				MachineJobApiErrorCode.LEASE_STALE,
				'The job lease token or attempt is stale; the job was reassigned. Drop this job and poll for new work.'
			)
		);
	}
	if (!job.leaseExpiresAt || job.leaseExpiresAt <= now) {
		throw new ConflictException(
			apiError(
				MachineJobApiErrorCode.LEASE_EXPIRED,
				'The job lease has expired. Drop this job and poll for new work.'
			)
		);
	}
}
