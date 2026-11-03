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
import { SnapshotRetention } from '@snapflow/machine-proto';
import { mergeDesiredSnapshots } from './desired-snapshot-set.util';

const IMAGE_REF = 'registry.example.com/snapflow/base:1.0';
const BUILD_REF = 'snapflow-build:snapflow';
const CANARY_REF = 'docker.io/library/alpine@sha256:abc';
const REGISTRY_ID = '5e4d3c2b-1a09-4f8e-9d7c-6b5a4f3e2d1c';
const TEMPLATE = {
	cpuQuota: 1,
	memoryQuota: 2,
	storageQuota: 5,
	capabilities: [],
};
const REQUIRED = SnapshotRetention.REQUIRED;
const PREWARM = SnapshotRetention.PREWARM;

describe('mergeDesiredSnapshots', () => {
	it('lists every referenced snapshot once, ordered by reference', () => {
		const merged = mergeDesiredSnapshots([
			{
				ref: IMAGE_REF,
				source: { kind: 'registry', registryId: REGISTRY_ID },
				template: null,
				retention: REQUIRED,
			},
			{
				ref: BUILD_REF,
				source: { kind: 'local' },
				template: null,
				retention: REQUIRED,
			},
			{
				ref: IMAGE_REF,
				source: { kind: 'registry', registryId: REGISTRY_ID },
				template: TEMPLATE,
				retention: REQUIRED,
			},
			{
				ref: CANARY_REF,
				source: { kind: 'registry' },
				template: null,
				retention: REQUIRED,
			},
		]);

		assert.deepEqual([...merged.keys()], [CANARY_REF, IMAGE_REF, BUILD_REF]);
		assert.deepEqual(merged.get(IMAGE_REF)?.template, TEMPLATE);
		assert.deepEqual(merged.get(BUILD_REF)?.source, { kind: 'local' });
	});

	it('prefers a named registry over an anonymous pull', () => {
		const merged = mergeDesiredSnapshots([
			{
				ref: IMAGE_REF,
				source: { kind: 'registry' },
				template: null,
				retention: REQUIRED,
			},
			{
				ref: IMAGE_REF,
				source: { kind: 'registry', registryId: REGISTRY_ID },
				template: null,
				retention: REQUIRED,
			},
		]);

		assert.deepEqual(merged.get(IMAGE_REF)?.source, {
			kind: 'registry',
			registryId: REGISTRY_ID,
		});
	});

	it('keeps the first template a demand asks for', () => {
		const sandboxTemplate = { ...TEMPLATE, cpuQuota: 4 };
		const merged = mergeDesiredSnapshots([
			{
				ref: BUILD_REF,
				source: { kind: 'local' },
				template: sandboxTemplate,
				retention: REQUIRED,
			},
			{
				ref: BUILD_REF,
				source: { kind: 'local' },
				template: TEMPLATE,
				retention: REQUIRED,
			},
		]);

		assert.deepEqual(merged.get(BUILD_REF)?.template, sandboxTemplate);
	});

	it('requires a pre-warmed snapshot any other demand requires', () => {
		const prewarm = {
			ref: IMAGE_REF,
			source: { kind: 'registry' as const, registryId: REGISTRY_ID },
			template: TEMPLATE,
			retention: PREWARM,
		};
		const merged = mergeDesiredSnapshots([
			prewarm,
			{ ...prewarm, template: null, retention: REQUIRED },
			{ ...prewarm, ref: CANARY_REF },
		]);

		assert.equal(merged.get(IMAGE_REF)?.retention, REQUIRED);
		assert.equal(merged.get(CANARY_REF)?.retention, PREWARM);
	});
});
