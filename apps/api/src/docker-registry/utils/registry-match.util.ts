/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DOCKER_HUB_URL } from '../persistence/constants/docker-registry-persistence.constants';
import { DockerRegistry } from '../persistence/entities/docker-registry.entity';
import { RegistryType } from '../persistence/enums/registry-type.enum';
import {
	registryEndpoint,
	registryHost,
} from '../persistence/utils/docker-registry-url.util';

const ORGANIZATION_REGISTRY_RANK = 0;
const SHARED_REGISTRY_RANK = 1;
const IMAGE_REFERENCE_HOST_BOUNDARIES: ReadonlySet<string> = new Set([
	'/',
	':',
]);
const TEMPORARY_REGISTRY_ID_PREFIX = 'temp-';
const TEMPORARY_REGISTRY_NAME_PREFIX = 'Temporary';

function registryRank(registry: DockerRegistry): number {
	return registry.registryType === RegistryType.ORGANIZATION
		? ORGANIZATION_REGISTRY_RANK
		: SHARED_REGISTRY_RANK;
}

function startsWithRegistryHost(reference: string, host: string): boolean {
	if (!reference.startsWith(host)) {
		return false;
	}
	const nextChar = reference.at(host.length);
	return (
		nextChar === undefined || IMAGE_REFERENCE_HOST_BOUNDARIES.has(nextChar)
	);
}

export function findRegistryByUrlMatch(
	registries: readonly DockerRegistry[],
	reference: string
): DockerRegistry | null {
	const ranked = [...registries].sort(
		(left, right) => registryRank(left) - registryRank(right)
	);
	return (
		ranked.find((registry) =>
			startsWithRegistryHost(reference, registryHost(registry.url))
		) ?? null
	);
}

export function isDockerHubRegistry(registry: DockerRegistry): boolean {
	const host = registryHost(registry.url);
	return host === DOCKER_HUB_URL || host.startsWith(`${DOCKER_HUB_URL}/`);
}

export function temporaryRegistryConfig(
	registryOrigin: string
): DockerRegistry {
	const registry = new DockerRegistry();
	registry.id = `${TEMPORARY_REGISTRY_ID_PREFIX}${registryOrigin}`;
	registry.name = `${TEMPORARY_REGISTRY_NAME_PREFIX} ${registryOrigin}`;
	registry.url = registryEndpoint(registryOrigin);
	registry.username = '';
	registry.password = '';
	registry.project = '';
	registry.registryType = RegistryType.INTERNAL;
	return registry;
}
