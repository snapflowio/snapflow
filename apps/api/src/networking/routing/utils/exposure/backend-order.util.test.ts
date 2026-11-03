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
import { sortByBackendId } from './backend-order.util';

describe('sortByBackendId', () => {
	it('orders by UTF-16 code units like the Go digest implementations', () => {
		const items = [
			{ backendId: 'b' },
			{ backendId: 'B' },
			{ backendId: 'a-1' },
			{ backendId: 'a1' },
		];

		assert.deepEqual(
			sortByBackendId(items).map(({ backendId }) => backendId),
			['B', 'a-1', 'a1', 'b']
		);
		assert.equal(items[0]?.backendId, 'b');
	});
});
