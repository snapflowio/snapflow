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
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import type { SandboxUsageScope } from './organization-usage.util';
import {
	calculateQuotaUsageDelta,
	countUsageKey,
	parseNonNegativeCachedValue,
	sandboxUsageKey,
	usageFetchedAtKey,
} from './organization-usage-cache.util';

const ORGANIZATION_ID = 'organization-1';
const SCOPE: SandboxUsageScope = {
	organizationId: ORGANIZATION_ID,
	sandboxClass: SandboxClass.LINUX_VM,
};
const CONSUMING_STATES = ['started'];

describe('organization usage cache keys', () => {
	it('scopes sandbox usage keys by sandbox class', () => {
		assert.equal(
			sandboxUsageKey('current', SCOPE, 'cpu'),
			`organization:organization-1:class:${SandboxClass.LINUX_VM}:quota:cpu:usage`
		);
		assert.equal(
			sandboxUsageKey('pending', SCOPE, 'gpu'),
			`organization:organization-1:class:${SandboxClass.LINUX_VM}:quota:gpu:pending`
		);
	});

	it('keeps count usage keys organization-wide', () => {
		assert.equal(
			countUsageKey('current', ORGANIZATION_ID, 'snapshot_count'),
			'organization:organization-1:quota:snapshot_count:usage'
		);
		assert.equal(
			countUsageKey('pending', ORGANIZATION_ID, 'volume_count'),
			'organization:organization-1:quota:volume_count:pending'
		);
	});

	it('builds staleness keys with and without a sandbox scope', () => {
		assert.equal(
			usageFetchedAtKey(ORGANIZATION_ID, 'sandbox', SCOPE),
			`organization:organization-1:class:${SandboxClass.LINUX_VM}:resource:sandbox:usage:fetched_at`
		);
		assert.equal(
			usageFetchedAtKey(ORGANIZATION_ID, 'volume'),
			'organization:organization-1:resource:volume:usage:fetched_at'
		);
	});
});

describe('parseNonNegativeCachedValue', () => {
	it('accepts non-negative numbers and rejects missing, negative or invalid values', () => {
		assert.equal(parseNonNegativeCachedValue('4'), 4);
		assert.equal(parseNonNegativeCachedValue('0'), 0);
		assert.equal(parseNonNegativeCachedValue(null), null);
		assert.equal(parseNonNegativeCachedValue('-1'), null);
		assert.equal(parseNonNegativeCachedValue('abc'), null);
	});
});

describe('calculateQuotaUsageDelta', () => {
	it('adds, removes or keeps usage on consumption transitions', () => {
		assert.equal(
			calculateQuotaUsageDelta(2, 'stopped', 'started', CONSUMING_STATES),
			2
		);
		assert.equal(
			calculateQuotaUsageDelta(2, 'started', 'stopped', CONSUMING_STATES),
			-2
		);
		assert.equal(
			calculateQuotaUsageDelta(2, 'started', 'started', CONSUMING_STATES),
			0
		);
	});
});
