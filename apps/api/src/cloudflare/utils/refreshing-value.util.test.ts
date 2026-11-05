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
import { RefreshingValue } from './refreshing-value.util';

const ALWAYS_EXPIRED = 0;
const ONE_HOUR_MILLISECONDS = 3_600_000;

describe('RefreshingValue', () => {
	it('shares one load between concurrent reads and caches it', async () => {
		let loads = 0;
		const value = new RefreshingValue(async () => {
			loads += 1;
			return loads;
		}, ONE_HOUR_MILLISECONDS);

		assert.deepEqual(await Promise.all([value.get(), value.get()]), [1, 1]);
		assert.equal(await value.get(), 1);
		assert.equal(loads, 1);
	});

	it('serves the last value while reloads fail', async () => {
		let fail = false;
		const value = new RefreshingValue(async () => {
			if (fail) throw new Error('unreachable');
			return 'loaded';
		}, ALWAYS_EXPIRED);

		assert.equal(await value.get(), 'loaded');
		fail = true;
		assert.equal(await value.get(), 'loaded');
	});

	it('propagates the error of a value never loaded', async () => {
		const value = new RefreshingValue(async () => {
			throw new Error('unreachable');
		}, ONE_HOUR_MILLISECONDS);

		await assert.rejects(value.get(), /unreachable/);
	});
});
