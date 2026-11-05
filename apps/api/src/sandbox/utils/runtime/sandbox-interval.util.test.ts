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
import { RETENTION_ARCHIVE_INTERVAL_MINUTES } from '../../constants/sandbox.constants';
import {
	resolveAutoArchiveInterval,
	retentionArchiveMinutes,
} from './sandbox-interval.util';

const THIRTY_DAYS_IN_MINUTES = 30 * 24 * 60;

describe('stopped sandbox retention', () => {
	it('archives after the settings retention by default', () => {
		const maximum = retentionArchiveMinutes({
			stoppedSandboxRetentionDays: 30,
		});
		assert.equal(maximum, THIRTY_DAYS_IN_MINUTES);
		assert.equal(
			resolveAutoArchiveInterval(RETENTION_ARCHIVE_INTERVAL_MINUTES, maximum),
			RETENTION_ARCHIVE_INTERVAL_MINUTES
		);
	});

	it('lets a customer choose a shorter interval but never a longer one', () => {
		const maximum = retentionArchiveMinutes({
			stoppedSandboxRetentionDays: 30,
		});
		assert.equal(resolveAutoArchiveInterval(60, maximum), 60);
		assert.equal(resolveAutoArchiveInterval(maximum + 1, maximum), maximum);
	});

	it('rejects a negative interval', () => {
		assert.throws(() => resolveAutoArchiveInterval(-1, THIRTY_DAYS_IN_MINUTES));
	});
});
