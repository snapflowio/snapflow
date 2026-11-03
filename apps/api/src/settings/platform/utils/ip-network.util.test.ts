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
import { parseIpNetwork } from './ip-network.util';

describe('parseIpNetwork', () => {
	it('accepts IPv4 and IPv6 networks', () => {
		assert.equal(parseIpNetwork('192.0.2.0/24'), '4:192.0.2.0/24');
		assert.equal(parseIpNetwork('203.0.113.7/32'), '4:203.0.113.7/32');
		assert.equal(parseIpNetwork('0.0.0.0/0'), '4:0.0.0.0/0');
		assert.equal(
			parseIpNetwork('2001:db8::/32'),
			parseIpNetwork('2001:0DB8:0:0::/32')
		);
		assert.ok(parseIpNetwork('::ffff:192.0.2.0/120').startsWith('6:'));
	});

	it('refuses addresses without a prefix, bad prefixes and host bits', () => {
		for (const value of [
			'192.0.2.1',
			'192.0.2.0/33',
			'192.0.2.0/-1',
			'192.0.2.0/24/1',
			'2001:db8::/129',
			'example.com/24',
			'192.0.2.1/24',
			'2001:db8::1/64',
		]) {
			assert.throws(() => parseIpNetwork(value), Error, value);
		}
	});
});
