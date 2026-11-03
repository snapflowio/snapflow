/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxState } from '../../../sandbox/instance/enums/sandbox-state.enum';

export const FULL_USAGE_STATES = [SandboxState.STARTED] as const;
export const DISK_ONLY_USAGE_STATES = [
	SandboxState.STOPPING,
	SandboxState.PAUSING,
	SandboxState.STOPPED,
	SandboxState.PAUSED,
] as const;
export const METERED_USAGE_STATES = [
	...FULL_USAGE_STATES,
	...DISK_ONLY_USAGE_STATES,
] as const;

export const UsageMode = {
	FULL: 'full',
	DISK: 'disk',
} as const;

export type UsageMode = (typeof UsageMode)[keyof typeof UsageMode];

export const USAGE_LIFECYCLE_RECONCILIATION = {
	BATCH_SIZE: 250,
	MAXIMUM_BATCHES: 20,
} as const;

export const USAGE_WINDOW_BATCH_SIZE = 100;
export const USAGE_ARCHIVE_BATCH_SIZE = 5_000;

export const USAGE_JOB = {
	LIFECYCLE_RECONCILIATION: 'reconcile-usage-lifecycle',
	WINDOW_ROTATION: 'close-and-reopen-usage-periods',
	ARCHIVE: 'archive-usage-periods',
} as const;

export const USAGE_LOCK = {
	SANDBOX_KEY_PREFIX: 'usage-period-',
	TTL_SECONDS: 60,
	WAIT_TIMEOUT_MILLISECONDS: 60_000,
	JOB_TTL_SECONDS: 60,
} as const;
