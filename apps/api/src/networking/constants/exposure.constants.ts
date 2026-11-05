/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const EXPOSURE_TARGET_HOST = {
	RUNTIME: 'runtime',
	MACHINE_BUILD_LOGS: 'machine-build-logs',
	MACHINE_SSH_GATEWAY: 'machine-ssh-gateway',
} as const;
export type ExposureTargetHost =
	(typeof EXPOSURE_TARGET_HOST)[keyof typeof EXPOSURE_TARGET_HOST];

export const EXPOSURE_KIND = {
	HTTP: 'http',
	TCP: 'tcp',
	UDP: 'udp',
	SYSTEM: 'system',
} as const;
export type ExposureKind = (typeof EXPOSURE_KIND)[keyof typeof EXPOSURE_KIND];

export const EXPOSURE_VISIBILITY = {
	PUBLIC: 'public',
	PROTECTED: 'protected',
} as const;
export type ExposureVisibility =
	(typeof EXPOSURE_VISIBILITY)[keyof typeof EXPOSURE_VISIBILITY];

export const EXPOSURE_DESIRED_STATE = {
	ACTIVE: 'active',
	DISABLED: 'disabled',
	DELETING: 'deleting',
	DELETED: 'deleted',
} as const;
export type ExposureDesiredState =
	(typeof EXPOSURE_DESIRED_STATE)[keyof typeof EXPOSURE_DESIRED_STATE];

export const EXPOSURE_OBSERVED_STATE = {
	PENDING: 'pending',
	ACTIVE: 'active',
	DEGRADED: 'degraded',
	FAILED: 'failed',
	DELETING: 'deleting',
	DELETED: 'deleted',
} as const;
export type ExposureObservedState =
	(typeof EXPOSURE_OBSERVED_STATE)[keyof typeof EXPOSURE_OBSERVED_STATE];

export const EXPOSURE_BACKEND_STATE = {
	PENDING: 'pending',
	ACTIVE: 'active',
	DRAINING: 'draining',
	FAILED: 'failed',
	RELEASED: 'released',
} as const;
export type ExposureBackendState =
	(typeof EXPOSURE_BACKEND_STATE)[keyof typeof EXPOSURE_BACKEND_STATE];

export const ACTIVE_BACKEND_STATES = [
	EXPOSURE_BACKEND_STATE.PENDING,
	EXPOSURE_BACKEND_STATE.ACTIVE,
	EXPOSURE_BACKEND_STATE.DRAINING,
] as const;

export const CUSTOM_DOMAIN_STATE = {
	PENDING: 'pending',
	VALIDATING: 'validating',
	ACTIVE: 'active',
	FAILED: 'failed',
	DELETING: 'deleting',
} as const;
export type CustomDomainState =
	(typeof CUSTOM_DOMAIN_STATE)[keyof typeof CUSTOM_DOMAIN_STATE];

export const SYSTEM_EXPOSURE_SERVICE = {
	TOOLBOX: 'toolbox',
	BUILD_LOGS: 'build_logs',
	TERMINAL: 'terminal',
	DESKTOP: 'desktop',
	SSH: 'ssh',
} as const;
export type SystemExposureService =
	(typeof SYSTEM_EXPOSURE_SERVICE)[keyof typeof SYSTEM_EXPOSURE_SERVICE];

export const SYSTEM_EXPOSURE_TARGET_PORT = {
	[SYSTEM_EXPOSURE_SERVICE.TOOLBOX]: 2_280,
	[SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS]: 2_280,
	[SYSTEM_EXPOSURE_SERVICE.TERMINAL]: 22_222,
	[SYSTEM_EXPOSURE_SERVICE.DESKTOP]: 6_080,
	[SYSTEM_EXPOSURE_SERVICE.SSH]: 2_220,
} as const satisfies Record<SystemExposureService, number>;

export const RESERVED_RUNTIME_TARGET_PORTS = [
	SYSTEM_EXPOSURE_TARGET_PORT[SYSTEM_EXPOSURE_SERVICE.TOOLBOX],
	SYSTEM_EXPOSURE_TARGET_PORT[SYSTEM_EXPOSURE_SERVICE.TERMINAL],
	SYSTEM_EXPOSURE_TARGET_PORT[SYSTEM_EXPOSURE_SERVICE.DESKTOP],
] as const;

export const SYSTEM_EXPOSURE_LEASE = {
	defaultDurationSeconds: 5 * 60,
	minimumDurationSeconds: 60,
	maximumDurationSeconds: 8 * 60 * 60,
	expirationBatchSize: 100,
} as const;

export const PREVIEW_EXPOSURE = {
	namePrefix: 'preview',
	path: '/',
	reconciliationBatchSize: 100,
} as const;

export const HTTP_EXPOSURE_PATH_PATTERN =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are precisely what route policy validation rejects.
	/^\/(?!\/)(?!.*[\\?#%\u0000-\u001f\u007f]).*$/;

export const EXPOSURE_CUTOVER = {
	rollbackFailureReason: 'Edge cutover was rolled back by an administrator',
	maximumListSize: 100,
} as const;
