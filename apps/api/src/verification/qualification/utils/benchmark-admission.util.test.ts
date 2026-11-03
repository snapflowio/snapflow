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
import {
	JOB_EXECUTION_OUTCOME,
	JOB_LIFECYCLE_PHASE,
} from '../../../sandbox/machine/constants/machine-reliability.constants';
import type { Job } from '../../../sandbox/machine-job/entities/job.entity';
import { JobErrorCode } from '../../../sandbox/machine-job/enums/job-error-code.enum';
import { JobStatus } from '../../../sandbox/machine-job/enums/job-status.enum';
import { benchmarkNotAdmitted } from './benchmark-admission.util';

const EXECUTION_SCHEMA_VERSION = 1;

function job(
	status: JobStatus,
	errorCode: JobErrorCode | null
): Pick<Job, 'status' | 'executionResult'> {
	return {
		status,
		executionResult: errorCode
			? {
					schemaVersion: EXECUTION_SCHEMA_VERSION,
					outcome: JOB_EXECUTION_OUTCOME.FAILED,
					phase: JOB_LIFECYCLE_PHASE.ADMISSION,
					errorCode,
					retryable: true,
					runtimeIdentity: 'runtime',
					releaseIdentity: 'release',
				}
			: null,
	};
}

describe('benchmarkNotAdmitted', () => {
	it('treats a challenge the machine could not admit as no verdict', () => {
		assert.equal(
			benchmarkNotAdmitted(
				job(JobStatus.FAILED, JobErrorCode.INSUFFICIENT_CAPACITY)
			),
			true
		);
	});

	it('keeps every other job failure a failed benchmark', () => {
		assert.equal(
			benchmarkNotAdmitted(job(JobStatus.FAILED, JobErrorCode.UNKNOWN)),
			false
		);
		assert.equal(benchmarkNotAdmitted(job(JobStatus.FAILED, null)), false);
	});

	it('never treats a completed job as not admitted', () => {
		assert.equal(
			benchmarkNotAdmitted(
				job(JobStatus.COMPLETED, JobErrorCode.INSUFFICIENT_CAPACITY)
			),
			false
		);
	});
});
