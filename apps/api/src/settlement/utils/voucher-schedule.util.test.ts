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
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_SECOND,
} from '../../common/constants/time.constants';
import {
	voucherCoverageLapsed,
	voucherExpiry,
	voucherReissueDue,
} from './voucher-schedule.util';

const NOW = new Date('2026-11-05T12:00:00.250Z');
const SETTINGS = { voucherIntervalSeconds: 60, voucherGraceIntervals: 2 };
const LIFETIME_HOURS = 24;

describe('voucherCoverageLapsed', () => {
	it('lapses only after the grace intervals', () => {
		const graceMilliseconds = 120 * MILLISECONDS_PER_SECOND;
		const coveredAt = new Date(NOW.getTime() - graceMilliseconds);
		assert.equal(voucherCoverageLapsed(coveredAt, NOW, SETTINGS), false);
		assert.equal(
			voucherCoverageLapsed(new Date(coveredAt.getTime() - 1), NOW, SETTINGS),
			true
		);
	});
});

describe('voucherExpiry', () => {
	it('expires a lifetime from now in whole seconds', () => {
		assert.deepEqual(
			voucherExpiry(NOW, LIFETIME_HOURS, null),
			new Date('2026-11-06T12:00:00.000Z')
		);
	});

	it('never outlives the session key that signs it', () => {
		const keyExpiresAt = new Date(NOW.getTime() + MILLISECONDS_PER_HOUR);
		assert.deepEqual(
			voucherExpiry(NOW, LIFETIME_HOURS, keyExpiresAt),
			new Date('2026-11-05T13:00:00.000Z')
		);
	});
});

describe('voucherReissueDue', () => {
	it('reissues once half the lifetime has passed', () => {
		const halfLife = (LIFETIME_HOURS / 2) * MILLISECONDS_PER_HOUR;
		assert.equal(
			voucherReissueDue(
				new Date(NOW.getTime() + halfLife + 1),
				NOW,
				LIFETIME_HOURS
			),
			false
		);
		assert.equal(
			voucherReissueDue(
				new Date(NOW.getTime() + halfLife),
				NOW,
				LIFETIME_HOURS
			),
			true
		);
	});
});
