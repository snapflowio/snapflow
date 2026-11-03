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
import { isForeignPlatformRegistryImage } from './platform-registry-image.util';
import { registryPushNamespace } from './registry-token-scope.util';

const ORGANIZATION_ID = 'c0ffee00-0000-4000-8000-000000000001';
const OTHER_ORGANIZATION_ID = 'c0ffee00-0000-4000-8000-000000000002';
const SNAPSHOT_MANAGER_HOST = 'snapshot-manager.example.com:5001';
const PLATFORM_REGISTRY_URLS = [
	`https://${SNAPSHOT_MANAGER_HOST}`,
	'http://backup.example.com',
];

function isForeign(imageName: string): boolean {
	return isForeignPlatformRegistryImage(
		imageName,
		PLATFORM_REGISTRY_URLS,
		ORGANIZATION_ID
	);
}

describe('isForeignPlatformRegistryImage', () => {
	it('allows images pushed to the organization namespace', () => {
		assert.equal(
			isForeign(
				`${SNAPSHOT_MANAGER_HOST}/${registryPushNamespace(ORGANIZATION_ID)}/app:1.0`
			),
			false
		);
	});

	it('rejects another organization push and internal snapshots', () => {
		assert.equal(
			isForeign(
				`${SNAPSHOT_MANAGER_HOST}/${registryPushNamespace(OTHER_ORGANIZATION_ID)}/app:1.0`
			),
			true
		);
		assert.equal(
			isForeign(`${SNAPSHOT_MANAGER_HOST}/snapflow/snapflow-abc:snapflow`),
			true
		);
		assert.equal(isForeign('backup.example.com/backups/sandbox:1'), true);
	});

	it('rejects a namespace that only shares the organization prefix', () => {
		assert.equal(
			isForeign(
				`${SNAPSHOT_MANAGER_HOST}/${registryPushNamespace(ORGANIZATION_ID)}-extra/app:1.0`
			),
			true
		);
	});

	it('allows public and organization registry images', () => {
		assert.equal(isForeign('ubuntu:24.04'), false);
		assert.equal(isForeign('ghcr.io/example/app:1.0'), false);
	});
});
