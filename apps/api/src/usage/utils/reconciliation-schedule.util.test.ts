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
import { RECONCILIATION_SCHEDULE } from '../constants/usage-accounting.constants';
import {
	deferFailedReconciliation,
	type ReconciliationSchedule,
	scheduleNextReconciliation,
} from './reconciliation-schedule.util';

const OBSERVED_AT = new Date('2026-09-14T12:00:00.000Z');

function schedule(reconcileAttempts: number): ReconciliationSchedule {
	return { reconcileAttempts, nextReconcileAt: OBSERVED_AT };
}

function delayAfter(target: ReconciliationSchedule): number {
	return target.nextReconcileAt.getTime() - OBSERVED_AT.getTime();
}

describe('reconciliation schedule', () => {
	it('backs failing rows off exponentially', () => {
		const target = schedule(0);

		deferFailedReconciliation(target, OBSERVED_AT);
		assert.equal(target.reconcileAttempts, 1);
		assert.equal(
			delayAfter(target),
			RECONCILIATION_SCHEDULE.BACKOFF_BASE_MILLISECONDS
		);

		deferFailedReconciliation(target, OBSERVED_AT);
		assert.equal(target.reconcileAttempts, 2);
		assert.equal(
			delayAfter(target),
			RECONCILIATION_SCHEDULE.BACKOFF_BASE_MILLISECONDS *
				RECONCILIATION_SCHEDULE.BACKOFF_MULTIPLIER
		);
	});

	it('caps the failure backoff', () => {
		const target = schedule(Number.MAX_SAFE_INTEGER - 1);

		deferFailedReconciliation(target, OBSERVED_AT);

		assert.equal(
			delayAfter(target),
			RECONCILIATION_SCHEDULE.BACKOFF_MAXIMUM_MILLISECONDS
		);
	});

	it('re-queues rows awaiting evidence and clears earlier failures', () => {
		const target = schedule(3);

		scheduleNextReconciliation(target, OBSERVED_AT);

		assert.equal(target.reconcileAttempts, 0);
		assert.equal(
			delayAfter(target),
			RECONCILIATION_SCHEDULE.POLL_INTERVAL_MILLISECONDS
		);
	});
});
