/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DOCKER_HUB_URL } from '../constants/docker-registry-persistence.constants';
import type { DockerRegistry } from '../entities/docker-registry.entity';

const DEFAULT_REGISTRY_PROJECT = 'snapflow';
const URL_SCHEME_PATTERN = /^https?:\/\//;
const TRAILING_SLASHES_PATTERN = /\/+$/;
const PLAINTEXT_REGISTRY_HOST_PREFIXES = ['localhost', '127.0.0.1'] as const;

export function registryEndpoint(url: string): string {
	const trimmed = url.trim().replace(TRAILING_SLASHES_PATTERN, '');
	if (URL_SCHEME_PATTERN.test(trimmed)) {
		return trimmed;
	}
	const scheme = PLAINTEXT_REGISTRY_HOST_PREFIXES.some((prefix) =>
		trimmed.startsWith(prefix)
	)
		? 'http'
		: 'https';
	return `${scheme}://${trimmed}`;
}

export function registryHost(url: string): string {
	return url
		.trim()
		.replace(URL_SCHEME_PATTERN, '')
		.replace(TRAILING_SLASHES_PATTERN, '');
}

export function normalizeRegistryUrl(url: string): string {
	if (!url || url.trim() === '' || url.toLowerCase().includes(DOCKER_HUB_URL)) {
		return DOCKER_HUB_URL;
	}
	return registryEndpoint(url);
}

export function registryRepositoryPrefix(
	registry: Pick<DockerRegistry, 'url' | 'project'>
): string {
	return `${registryHost(registry.url)}/${registry.project || DEFAULT_REGISTRY_PROJECT}`;
}
