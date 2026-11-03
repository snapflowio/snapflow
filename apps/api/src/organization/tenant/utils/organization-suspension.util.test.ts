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
import { isSuspensionActive } from './organization-suspension.util';

const NOW = new Date('2026-10-13T12:00:00Z');
const EARLIER = new Date('2026-10-12T12:00:00Z');
const LATER = new Date('2026-10-14T12:00:00Z');

describe('isSuspensionActive', () => {
	it('treats an unsuspended organization as active', () => {
		assert.equal(
			isSuspensionActive({ suspended: false, suspendedUntil: null }, NOW),
			false
		);
	});

	it('keeps an indefinite suspension in force', () => {
		assert.equal(
			isSuspensionActive({ suspended: true, suspendedUntil: null }, NOW),
			true
		);
	});

	it('ends a suspension once its end time has passed', () => {
		assert.equal(
			isSuspensionActive({ suspended: true, suspendedUntil: LATER }, NOW),
			true
		);
		assert.equal(
			isSuspensionActive({ suspended: true, suspendedUntil: EARLIER }, NOW),
			false
		);
	});
});
