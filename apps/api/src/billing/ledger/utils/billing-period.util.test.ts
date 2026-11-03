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
import { utcBillingMonth } from './billing-period.util';

describe('UTC billing month', () => {
	it('uses UTC month boundaries regardless of the local offset', () => {
		const period = utcBillingMonth(new Date('2026-09-30T23:30:00.000-05:00'));
		assert.equal(period.start.toISOString(), '2026-10-01T00:00:00.000Z');
		assert.equal(period.end.toISOString(), '2026-11-01T00:00:00.000Z');
	});

	it('rolls over the year in December', () => {
		const period = utcBillingMonth(new Date('2026-12-15T12:00:00.000Z'));
		assert.equal(period.start.toISOString(), '2026-12-01T00:00:00.000Z');
		assert.equal(period.end.toISOString(), '2027-01-01T00:00:00.000Z');
	});
});
