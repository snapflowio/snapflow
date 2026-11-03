/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { Job } from '../entities/job.entity';
import { JobStatus } from '../enums/job-status.enum';

export function assertActiveLease(
	job: Job,
	machineId: string,
	leaseToken: string,
	attempt: number,
	now: Date
): void {
	if (job.machineId !== machineId) {
		throw new ForbiddenException('Machine does not own this job');
	}
	if (
		job.status !== JobStatus.IN_PROGRESS ||
		job.leaseToken !== leaseToken ||
		job.attempt !== attempt
	) {
		throw new ConflictException('Job lease token or attempt is stale');
	}
	if (!job.leaseExpiresAt || job.leaseExpiresAt <= now) {
		throw new ConflictException('Job lease has expired');
	}
}
