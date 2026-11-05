/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { addMilliseconds } from '../../common/utils/time.util';
import { JOB_PROJECTION_RETRY } from '../constants/job-execution.constants';
import { JobProjectionStatus } from '../enums/job-projection-status.enum';

export type ProjectionFailureOutcome =
	| { status: JobProjectionStatus.PENDING; retryAt: Date }
	| { status: JobProjectionStatus.FAILED; retryAt: null };

const BACKOFF_FACTOR = 2;

export function projectionFailureOutcome(
	attempts: number,
	failedAt: Date
): ProjectionFailureOutcome {
	if (attempts >= JOB_PROJECTION_RETRY.maxAttempts) {
		return { status: JobProjectionStatus.FAILED, retryAt: null };
	}
	const delay = Math.min(
		JOB_PROJECTION_RETRY.baseDelayMilliseconds *
			BACKOFF_FACTOR ** Math.max(0, attempts - 1),
		JOB_PROJECTION_RETRY.maxDelayMilliseconds
	);
	return {
		status: JobProjectionStatus.PENDING,
		retryAt: addMilliseconds(failedAt, delay),
	};
}
