/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { countLabel } from '../../common/utils/count-label.util';
import type { QuotaTierLimitKey } from '../../organization/types/quota-tier.types';
import type { SandboxQuotaResource } from '../../organization/utils/organization-usage.util';

export type PerSandboxResource = 'cpu' | 'memory' | 'disk';

export const TOTAL_QUOTA_TIER_LIMIT = {
	cpu: 'totalCpu',
	memory: 'totalMemory',
	disk: 'totalDisk',
	gpu: 'totalGpu',
} as const satisfies Record<SandboxQuotaResource, QuotaTierLimitKey>;

export const PER_SANDBOX_TIER_LIMIT = {
	cpu: 'maxCpuPerSandbox',
	memory: 'maxMemoryPerSandbox',
	disk: 'maxDiskPerSandbox',
} as const satisfies Record<PerSandboxResource, QuotaTierLimitKey>;

const STOP_SANDBOXES_MESSAGE = 'Stop sandboxes you no longer need.';

const ARCHIVE_SANDBOXES_MESSAGE =
	'Archive sandboxes you no longer need to free disk.';

export const QUOTA_EXCEEDED_MESSAGE = {
	cpu: (maximum, tierHint) =>
		`Organization CPU limit reached: sandboxes may use at most ${countLabel(maximum, 'vCPU')} in total. ${STOP_SANDBOXES_MESSAGE} ${tierHint}`,
	memory: (maximum, tierHint) =>
		`Organization memory limit reached: sandboxes may use at most ${maximum} GiB in total. ${STOP_SANDBOXES_MESSAGE} ${tierHint}`,
	disk: (maximum, tierHint) =>
		`Organization disk limit reached: sandboxes may use at most ${maximum} GiB in total. ${ARCHIVE_SANDBOXES_MESSAGE} ${tierHint}`,
	gpu: (maximum, tierHint) =>
		`Organization GPU limit reached: sandboxes may use at most ${countLabel(maximum, 'GPU')} in total. ${tierHint}`,
} as const satisfies Record<
	SandboxQuotaResource,
	(maximum: number, tierHint: string) => string
>;

export const PER_SANDBOX_LIMIT_EXCEEDED_MESSAGE = {
	cpu: (requested, maximum, tierHint) =>
		`This sandbox requests ${countLabel(requested, 'vCPU')}, above the per-sandbox limit of ${maximum}. Request fewer vCPUs. ${tierHint}`,
	memory: (requested, maximum, tierHint) =>
		`This sandbox requests ${requested} GiB of memory, above the per-sandbox limit of ${maximum} GiB. Request less memory. ${tierHint}`,
	disk: (requested, maximum, tierHint) =>
		`This sandbox requests ${requested} GiB of disk, above the per-sandbox limit of ${maximum} GiB. Request less disk. ${tierHint}`,
} as const satisfies Record<
	PerSandboxResource,
	(requested: number, maximum: number, tierHint: string) => string
>;

export const PERSISTENT_DISK_LIMIT_EXCEEDED_MESSAGE = (
	requested: number,
	maximum: number
) =>
	`This sandbox requests ${requested} GiB of disk, above the ${maximum} GiB limit for standard sandboxes. Create an ephemeral sandbox, or request less disk.`;

export const PERSISTENT_SANDBOX_NOT_ALLOWED_MESSAGE =
	'This organization may only run ephemeral sandboxes. Create the sandbox in ephemeral mode.';

export const SANDBOX_CLASS_NOT_ALLOWED_MESSAGE = (sandboxClass: string) =>
	`This organization cannot run ${sandboxClass} sandboxes. Choose another sandbox class, or request higher limits for it on the Limits page.`;

export const GPU_SNAPSHOT_NOT_ALLOWED_MESSAGE = (
	sandboxClass: string,
	tierHint: string
) =>
	`This organization has no GPU quota for ${sandboxClass} sandboxes, so it cannot build a GPU snapshot. Build a snapshot without GPUs. ${tierHint}`;
