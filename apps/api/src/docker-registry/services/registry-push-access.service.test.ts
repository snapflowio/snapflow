/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { fakeInstance } from '../../common/testing/instance.fake';
import { OrganizationService } from '../../organization/services/organization.service';
import { REGISTRY_TOKEN } from '../constants/registry-token.constants';
import { fakeRegistryTokens } from '../testing/registry-token-signer.fake';
import { DockerRegistryLookupService } from './docker-registry-lookup.service';
import { RegistryPushAccessService } from './registry-push-access.service';

const ORGANIZATION_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const USER_ID = '2b8d4f6a-1c3e-4a5b-8d7f-9e0a1b2c3d4e';
const MILLISECONDS_PER_SECOND = 1_000;

describe('RegistryPushAccessService.getPushAccess', () => {
	it('issues a user token scoped to the organization push namespace', async () => {
		const { tokens, snapshotManager, verify } = fakeRegistryTokens();
		const registryLookup = fakeInstance(DockerRegistryLookupService);
		mock.method(registryLookup, 'getAvailableTransientRegistry', () =>
			snapshotManager.transient()
		);
		const organizations = fakeInstance(OrganizationService);
		mock.method(organizations, 'assertActive', async () => undefined);
		const service = new RegistryPushAccessService(
			registryLookup,
			organizations,
			tokens
		);

		const access = await service.getPushAccess(ORGANIZATION_ID, USER_ID);

		assert.equal(access.username, REGISTRY_TOKEN.USERNAME);
		assert.equal(access.registryUrl, 'localhost:5001');
		assert.equal(access.registryId, snapshotManager.transient().id);
		assert.equal(access.project, `transient/${ORGANIZATION_ID}`);
		const claims = await verify(access.secret);
		assert.equal(claims.sub, `user:${USER_ID}`);
		assert.deepEqual(claims.access, [
			{
				type: 'repository',
				name: `transient/${ORGANIZATION_ID}/*`,
				actions: ['pull', 'push'],
			},
		]);
		assert.equal(
			new Date(access.expiresAt).getTime(),
			(claims.exp ?? Number.NaN) * MILLISECONDS_PER_SECOND
		);
	});
});
