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
import { DOCKER_HUB_URL } from '../constants/docker-registry-persistence.constants';
import {
	normalizeRegistryUrl,
	registryEndpoint,
	registryHost,
} from './docker-registry-url.util';

describe('registry URL forms', () => {
	it('persists absolute endpoints and keeps explicit schemes', () => {
		assert.equal(
			registryEndpoint('http://localhost:5001/'),
			'http://localhost:5001'
		);
		assert.equal(registryEndpoint('ghcr.io'), 'https://ghcr.io');
		assert.equal(registryEndpoint('localhost:5001'), 'http://localhost:5001');
		assert.equal(normalizeRegistryUrl(' ghcr.io/ '), 'https://ghcr.io');
	});

	it('keeps Docker Hub as its canonical host', () => {
		assert.equal(normalizeRegistryUrl('https://docker.io'), DOCKER_HUB_URL);
		assert.equal(normalizeRegistryUrl(''), DOCKER_HUB_URL);
	});

	it('derives the image reference host from an endpoint', () => {
		assert.equal(registryHost('https://ghcr.io/'), 'ghcr.io');
		assert.equal(registryHost('http://localhost:5001'), 'localhost:5001');
	});
});
