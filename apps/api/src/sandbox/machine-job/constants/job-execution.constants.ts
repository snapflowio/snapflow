/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { JobType } from '../enums/job-type.enum';

export const JOB_POLL_DEFAULT_LIMIT = 10;
export const JOB_POLL_MAX_LIMIT = 100;
export const JOB_COMPLETION_POLL_INTERVAL_MS = 100;

export const JOB_DEFAULT_MAX_ATTEMPTS = 3;
export const JOB_LEASE_EXPIRY_BATCH_SIZE = 500;
export const JOB_PROJECTION_BATCH_SIZE = 100;
export const JOB_PROJECTION_STALE_AFTER_MINUTES = 5;
export const JOB_PROJECTION_RETRY = {
	maxAttempts: 8,
	baseDelayMilliseconds: 30 * 1_000,
	maxDelayMilliseconds: 60 * 60 * 1_000,
} as const;
export const JOB_SUPERSEDED_MESSAGE = 'Superseded by job';

export const JOB_LEASE_DURATION_MILLISECONDS = 10 * MILLISECONDS_PER_MINUTE;

export const JOB_CONTROLLER_PATH = 'jobs';
export const JOB_STATUS_ROUTE = ':jobId/status';
export const JOB_STATUS_REQUEST_BODY_LIMIT = '4mb';

export const VERIFICATION_JOB_TYPES: ReadonlySet<JobType> = new Set([
	JobType.QUALIFY_MACHINE,
	JobType.BENCHMARK_MACHINE,
]);
