/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

/**
 * Registry tokens follow the distribution token claim shape: an Ed25519 JWT
 * signed through OpenBao transit, presented as the Basic password of
 * `USERNAME`, and verified offline by the snapshot manager against the JWKS
 * this api serves.
 */
export const REGISTRY_TOKEN = {
	USERNAME: 'snapflow-token',
	ISSUER: 'snapflow-api',
	AUDIENCE: 'snapflow-registry',
	ALGORITHM: 'EdDSA',
	TYPE: 'JWT',
	RESOURCE_TYPE: 'repository',
	TRANSIT_MOUNT: 'transit',
	TRANSIT_KEY: 'snapflow-registry',
	KEY_ID_VERSION_SEPARATOR: '-v',
	PULL_TTL_SECONDS: 600,
	PUSH_TTL_SECONDS: 3_600,
	SERVICE_TTL_SECONDS: 300,
	KEY_CACHE_MILLISECONDS: 60_000,
} as const;

export const REGISTRY_JWK = {
	KEY_TYPE: 'OKP',
	CURVE: 'Ed25519',
	USE: 'sig',
	TRANSIT_KEY_TYPE: 'ed25519',
	TRANSIT_SIGNATURE_PATTERN: /^vault:v(\d+):(.+)$/,
} as const;

export const RegistryAction = {
	PULL: 'pull',
	PUSH: 'push',
	DELETE: 'delete',
} as const;

export type RegistryAction =
	(typeof RegistryAction)[keyof typeof RegistryAction];

export const RegistrySubjectKind = {
	MACHINE: 'machine',
	ORGANIZATION: 'org',
	USER: 'user',
	SERVICE: 'service',
} as const;

export type RegistrySubjectKind =
	(typeof RegistrySubjectKind)[keyof typeof RegistrySubjectKind];

export const REGISTRY_SERVICE_SUBJECT = 'api';

export const REGISTRY_REPOSITORY = {
	PATH_SEPARATOR: '/',
	NAMESPACE_WILDCARD: '*',
	TRANSIENT_NAMESPACE: 'transient',
	BUILD_CACHE_REPOSITORY: 'buildcache',
	MIRROR_NAMESPACE: 'mirror/docker.io',
	DIGEST_SEPARATOR: '@',
	TAG_SEPARATOR: ':',
} as const;

export const PULL_ACTIONS: readonly RegistryAction[] = [RegistryAction.PULL];
export const PUSH_ACTIONS: readonly RegistryAction[] = [
	RegistryAction.PULL,
	RegistryAction.PUSH,
];
export const DELETE_ACTIONS: readonly RegistryAction[] = [
	RegistryAction.PULL,
	RegistryAction.DELETE,
];
