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
import { isEdgeSessionGenerationAccepted } from './edge-session-generation.util';

describe('isEdgeSessionGenerationAccepted', () => {
	const observedAt = new Date('2026-01-01T00:00:00.000Z');

	it('accepts the active generation', () => {
		assert.equal(isEdgeSessionGenerationAccepted(4, 4, null, observedAt), true);
	});

	it('accepts only the immediate replacement during its grace window', () => {
		const graceExpiresAt = new Date('2026-01-01T00:00:01.000Z');
		assert.equal(
			isEdgeSessionGenerationAccepted(5, 4, graceExpiresAt, observedAt),
			true
		);
		assert.equal(
			isEdgeSessionGenerationAccepted(6, 4, graceExpiresAt, observedAt),
			false
		);
	});

	it('rejects a replacement after the grace window', () => {
		assert.equal(
			isEdgeSessionGenerationAccepted(5, 4, observedAt, observedAt),
			false
		);
	});
});
