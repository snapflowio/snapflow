/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { addMilliseconds } from '../../../common/utils/time.util';
import {
	INITIAL_RECONCILE_ATTEMPTS,
	RECONCILIATION_SCHEDULE,
} from '../constants/usage-accounting.constants';

export interface ReconciliationSchedule {
	reconcileAttempts: number;
	nextReconcileAt: Date;
}

export function scheduleNextReconciliation(
	target: ReconciliationSchedule,
	observedAt: Date
): void {
	target.reconcileAttempts = INITIAL_RECONCILE_ATTEMPTS;
	target.nextReconcileAt = addMilliseconds(
		observedAt,
		RECONCILIATION_SCHEDULE.POLL_INTERVAL_MILLISECONDS
	);
}

export function deferFailedReconciliation(
	target: ReconciliationSchedule,
	failedAt: Date
): void {
	const attempts = target.reconcileAttempts + 1;
	const delayMilliseconds = Math.min(
		RECONCILIATION_SCHEDULE.BACKOFF_BASE_MILLISECONDS *
			RECONCILIATION_SCHEDULE.BACKOFF_MULTIPLIER ** (attempts - 1),
		RECONCILIATION_SCHEDULE.BACKOFF_MAXIMUM_MILLISECONDS
	);
	target.reconcileAttempts = attempts;
	target.nextReconcileAt = addMilliseconds(failedAt, delayMilliseconds);
}
