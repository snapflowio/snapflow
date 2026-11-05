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
import { validateNetworkAllowList } from './network-validation.util';

describe('validateNetworkAllowList', () => {
	it('accepts public IPv4 CIDR ranges', () => {
		assert.doesNotThrow(() =>
			validateNetworkAllowList('1.1.1.0/24, 8.8.8.8/32')
		);
	});

	it('rejects an exact protected range', () => {
		assert.throws(
			() => validateNetworkAllowList('10.0.0.0/8'),
			/overlaps protected destination 10\.0\.0\.0\/8/
		);
	});

	it('rejects a range that contains a protected range', () => {
		assert.throws(
			() => validateNetworkAllowList('8.0.0.0/6'),
			/overlaps protected destination 10\.0\.0\.0\/8/
		);
	});

	it('rejects a range contained by a protected range', () => {
		assert.throws(
			() => validateNetworkAllowList('192.168.10.0/24'),
			/overlaps protected destination 192\.168\.0\.0\/16/
		);
	});

	it('rejects a partially parsed prefix', () => {
		assert.throws(
			() => validateNetworkAllowList('8.8.8.0/24junk'),
			/Invalid CIDR prefix length/
		);
	});

	it('rejects an out-of-range prefix', () => {
		assert.throws(
			() => validateNetworkAllowList('8.8.8.8/33'),
			/Prefix must be between 0 and 32/
		);
	});
});
