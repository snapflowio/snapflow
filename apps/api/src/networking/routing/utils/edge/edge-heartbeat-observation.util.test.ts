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
import { routeSnapshotAcknowledgementIsCurrent } from './edge-heartbeat-observation.util';

describe('Edge heartbeat observations', () => {
	it('accepts acknowledgements only for the desired route snapshot', () => {
		assert.equal(routeSnapshotAcknowledgementIsCurrent('42', '42'), true);
		assert.equal(routeSnapshotAcknowledgementIsCurrent('43', '42'), false);
	});
});
