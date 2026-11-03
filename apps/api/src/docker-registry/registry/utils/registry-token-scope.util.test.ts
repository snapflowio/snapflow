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
import {
	PULL_ACTIONS,
	PUSH_ACTIONS,
} from '../constants/registry-token.constants';
import {
	isRegistryPushImage,
	mergeRegistryAccess,
	namespaceAccess,
	referenceRepository,
	registryBuildCacheNamespace,
	registryPushNamespace,
} from './registry-token-scope.util';

const ORGANIZATION_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const OTHER_ORGANIZATION_ID = '0d5e1c2b-3a4f-4e6d-8c7b-9a0f1e2d3c4b';
const REGISTRY_URL = 'http://localhost:5001';

describe('registry token scopes', () => {
	it('names the repository of a reference without host, tag or digest', () => {
		assert.equal(
			referenceRepository('localhost:5001/snapflow/snapshot-abc:v1'),
			'snapflow/snapshot-abc'
		);
		assert.equal(
			referenceRepository(
				'registry.snapflow.io:9443/snapflow/backup-abc@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
			),
			'snapflow/backup-abc'
		);
	});

	it('grants namespaces through a wildcard below them', () => {
		assert.deepEqual(
			namespaceAccess(
				registryBuildCacheNamespace(ORGANIZATION_ID),
				PUSH_ACTIONS
			),
			{
				name: `transient/${ORGANIZATION_ID}/buildcache/*`,
				actions: PUSH_ACTIONS,
			}
		);
	});

	it('recognises only images pushed to the organization namespace', () => {
		const pushed = `localhost:5001/${registryPushNamespace(ORGANIZATION_ID)}/app:latest`;
		assert.equal(
			isRegistryPushImage(pushed, REGISTRY_URL, ORGANIZATION_ID),
			true
		);
		assert.equal(
			isRegistryPushImage(pushed, REGISTRY_URL, OTHER_ORGANIZATION_ID),
			false
		);
		assert.equal(
			isRegistryPushImage(
				`localhost:5001/transient/${ORGANIZATION_ID}-other/app`,
				REGISTRY_URL,
				ORGANIZATION_ID
			),
			false
		);
	});

	it('merges repeated repositories into one entry per name', () => {
		assert.deepEqual(
			mergeRegistryAccess([
				{ name: 'snapflow/a', actions: PULL_ACTIONS },
				{ name: 'snapflow/a', actions: PUSH_ACTIONS },
				{ name: 'snapflow/b', actions: PULL_ACTIONS },
			]),
			[
				{ name: 'snapflow/a', actions: ['pull', 'push'] },
				{ name: 'snapflow/b', actions: ['pull'] },
			]
		);
	});
});
