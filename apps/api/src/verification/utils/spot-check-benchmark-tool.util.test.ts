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
import { spotCheckPlatform } from './spot-check-benchmark-tool.util';

describe('spot-check benchmark platform', () => {
	it('picks the first platform the API ships a tool for', () => {
		assert.equal(
			spotCheckPlatform(['linux/riscv64', 'linux/arm64']),
			'linux/arm64'
		);
	});

	it('rejects host-reported platforms that are not shipped', () => {
		assert.equal(spotCheckPlatform(['../../etc/passwd']), null);
	});
});
