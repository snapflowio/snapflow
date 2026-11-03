/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const JOB_MACHINE_API_VERSION = '2' as const;
export const MACHINE_DEVELOPMENT_APP_VERSION = 'v0.0.0-dev' as const;
export const MACHINE_HEALTH_STALE_THRESHOLD_MS = 60_000;
export const MACHINE_SSH_HOST_PUBLIC_KEY_MAX_LENGTH = 1_024;
export const MACHINE_READINESS_REASON_MAX_LENGTH = 1_024;
export const MACHINE_IDENTITY_REVOKED_REASON = 'Machine identity revoked';

export const MACHINE_HEALTH_CHECK = {
	JOB_NAME: 'check-machines',
	LOCK_TTL_SECONDS: 60,
} as const;

export const MACHINE_DECOMMISSION_CHECK = {
	JOB_NAME: 'check-decommission-machines',
	LOCK_TTL_SECONDS: 60,
	CURSOR_KEY: 'check-decommission-machines-cursor',
	DRAINING_CHECK_KEY_PREFIX: 'snapflow:draining-check:',
	DRAINING_CHECK_TTL_SECONDS: 600,
	DRAINING_CHECKS_REQUIRED: 3,
} as const;
