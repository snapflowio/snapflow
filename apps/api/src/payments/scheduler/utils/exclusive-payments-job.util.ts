/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import {
	type ExclusivePaymentsJob,
	PAYMENTS_JOB_LOCK_TTL_SECONDS,
} from '../../funds/constants/payments.constants';

// Runs a payments job on at most one API instance at a time; an instance that
// finds the job already running skips this tick.
export async function runExclusivePaymentsJob(
	locks: RedisLockProvider,
	job: ExclusivePaymentsJob,
	task: () => Promise<void>
): Promise<void> {
	await locks.runExclusive(job, PAYMENTS_JOB_LOCK_TTL_SECONDS[job], task);
}
