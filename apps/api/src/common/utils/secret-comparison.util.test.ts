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
import { secretsEqual } from './secret-comparison.util';

describe('secret comparison', () => {
	it('accepts the same secret', () => {
		assert.equal(
			secretsEqual('development-secret', 'development-secret'),
			true
		);
	});

	it('rejects a different secret of any length', () => {
		assert.equal(secretsEqual('development-secret', 'development'), false);
		assert.equal(
			secretsEqual('development-secret', 'development-secreT'),
			false
		);
	});
});
