/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ImageReference } from '../../common/values/image-reference.value';
import {
	REGISTRY_REPOSITORY,
	type RegistryAction,
	type RegistrySubjectKind,
} from '../constants/registry-token.constants';
import { registryHost } from '../persistence/utils/docker-registry-url.util';

export type RegistryAccess = Readonly<{
	name: string;
	actions: readonly RegistryAction[];
}>;

export type RegistryGrant = Readonly<{
	subject: string;
	access: readonly RegistryAccess[];
	ttlSeconds: number;
}>;

const separator = REGISTRY_REPOSITORY.PATH_SEPARATOR;

export function registrySubject(kind: RegistrySubjectKind, id: string): string {
	return `${kind}:${id}`;
}

/** The repository an image reference names, without host, tag or digest. */
export function referenceRepository(reference: string): string {
	return ImageReference.parse(reference).path;
}

export function repositoryAccess(
	reference: string,
	actions: readonly RegistryAction[]
): RegistryAccess {
	return { name: referenceRepository(reference), actions };
}

/** Grants every repository below `namespace`, never the namespace itself. */
export function namespaceAccess(
	namespace: string,
	actions: readonly RegistryAction[]
): RegistryAccess {
	return {
		name: `${namespace}${separator}${REGISTRY_REPOSITORY.NAMESPACE_WILDCARD}`,
		actions,
	};
}

export function registryPushNamespace(organizationId: string): string {
	return `${REGISTRY_REPOSITORY.TRANSIENT_NAMESPACE}${separator}${organizationId}`;
}

export function registryBuildCacheNamespace(organizationId: string): string {
	return `${registryPushNamespace(organizationId)}${separator}${REGISTRY_REPOSITORY.BUILD_CACHE_REPOSITORY}`;
}

export function isRegistryPushImage(
	imageName: string,
	registryUrl: string,
	organizationId: string
): boolean {
	return imageName.startsWith(
		`${registryHost(registryUrl)}${separator}${registryPushNamespace(organizationId)}${separator}`
	);
}

/** Merges grants for the same repository so a token lists each name once. */
export function mergeRegistryAccess(
	entries: readonly RegistryAccess[]
): RegistryAccess[] {
	const merged = new Map<string, Set<RegistryAction>>();
	for (const entry of entries) {
		const actions = merged.get(entry.name) ?? new Set<RegistryAction>();
		for (const action of entry.actions) actions.add(action);
		merged.set(entry.name, actions);
	}
	return [...merged].map(([name, actions]) => ({
		name,
		actions: [...actions].sort(),
	}));
}
