/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Job } from '../entities/job.entity';
import { JobProjectionStatus } from '../enums/job-projection-status.enum';
import { JobStatus } from '../enums/job-status.enum';
import { abandonJobLease } from './abandoned-job-lease.util';

function leasedJob(attempt: number, maxAttempts: number): Job {
	return Object.assign(new Job(), {
		attempt,
		maxAttempts,
		status: JobStatus.IN_PROGRESS,
		leaseToken: '1e2168a9-b328-4fa3-b65f-cb6206c5367d',
		leaseExpiresAt: new Date('2026-01-01T00:01:00.000Z'),
		leasedBySessionId: 'c2d44aee-18c8-4c70-9d2c-7c86e1465f5e',
		completedAt: null,
		errorMessage: null,
		projectionStatus: JobProjectionStatus.NOT_REQUIRED,
	});
}

describe('abandonJobLease', () => {
	const now = new Date('2026-01-01T00:00:00.000Z');

	it('requeues a job while an attempt remains', () => {
		const job = leasedJob(1, 3);
		assert.equal(
			abandonJobLease(job, now, 'machine session ended'),
			'requeued'
		);
		assert.equal(job.status, JobStatus.PENDING);
		assert.equal(job.availableAt, now);
		assert.equal(job.leaseToken, null);
		assert.equal(job.leasedBySessionId, null);
		assert.equal(job.projectionStatus, JobProjectionStatus.NOT_REQUIRED);
	});

	it('fails and schedules projection after the final attempt', () => {
		const job = leasedJob(3, 3);
		assert.equal(abandonJobLease(job, now, 'machine session ended'), 'failed');
		assert.equal(job.status, JobStatus.FAILED);
		assert.equal(job.completedAt, now);
		assert.equal(job.errorMessage, 'machine session ended');
		assert.equal(job.projectionStatus, JobProjectionStatus.PENDING);
	});
});
