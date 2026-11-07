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
import { nextBlockRange } from './block-range.util';

const MAXIMUM_BLOCKS = 1_000n;

describe('nextBlockRange', () => {
	it('starts at the first block before anything is indexed', () => {
		assert.deepEqual(nextBlockRange(null, 500n, 700n, MAXIMUM_BLOCKS), {
			fromBlock: 500n,
			toBlock: 700n,
		});
	});

	it('continues right after the last indexed block, bounded in width', () => {
		assert.deepEqual(nextBlockRange(999n, 0n, 5_000n, MAXIMUM_BLOCKS), {
			fromBlock: 1_000n,
			toBlock: 1_999n,
		});
	});

	it('stops at the confirmed head', () => {
		assert.equal(nextBlockRange(700n, 0n, 700n, MAXIMUM_BLOCKS), null);
		assert.equal(nextBlockRange(null, 10n, -5n, MAXIMUM_BLOCKS), null);
		assert.deepEqual(nextBlockRange(699n, 0n, 700n, MAXIMUM_BLOCKS), {
			fromBlock: 700n,
			toBlock: 700n,
		});
	});
});
