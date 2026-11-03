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
import { isBanActive } from './user-ban.util';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const EARLIER = new Date('2026-10-13T11:00:00.000Z');
const LATER = new Date('2026-10-13T13:00:00.000Z');

describe('isBanActive', () => {
	it('treats a ban without expiry as active', () => {
		assert.equal(isBanActive({ banned: true, banExpires: null }, NOW), true);
	});

	it('treats a ban until a future time as active', () => {
		assert.equal(isBanActive({ banned: true, banExpires: LATER }, NOW), true);
	});

	it('treats an expired ban as inactive', () => {
		assert.equal(
			isBanActive({ banned: true, banExpires: EARLIER }, NOW),
			false
		);
	});

	it('reports no active ban for an unbanned user', () => {
		assert.equal(isBanActive({ banned: false, banExpires: null }, NOW), false);
	});
});
