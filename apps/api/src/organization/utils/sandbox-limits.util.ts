/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { OrganizationQuotaDto } from '../dto/organization-quota.dto';
import type { OrganizationLimits } from '../entities/organization-limits.entity';

export function getEffectivePerSandboxLimits(
	organizationLimits: Pick<
		OrganizationLimits,
		'maxCpuPerSandbox' | 'maxMemoryPerSandbox' | 'maxDiskPerSandbox'
	>,
	quota: OrganizationQuotaDto | null | undefined,
	gpuEnabled: boolean
): {
	maxCpuPerSandbox: number;
	maxMemoryPerSandbox: number;
	maxDiskPerSandbox: number;
	maxDiskPerNonEphemeralSandbox: number | null;
} {
	if (gpuEnabled) {
		return {
			maxCpuPerSandbox:
				quota?.maxCpuPerGpuSandbox ??
				quota?.maxCpuPerSandbox ??
				organizationLimits.maxCpuPerSandbox,
			maxMemoryPerSandbox:
				quota?.maxMemoryPerGpuSandbox ??
				quota?.maxMemoryPerSandbox ??
				organizationLimits.maxMemoryPerSandbox,
			maxDiskPerSandbox:
				quota?.maxDiskPerGpuSandbox ??
				quota?.maxDiskPerSandbox ??
				organizationLimits.maxDiskPerSandbox,
			maxDiskPerNonEphemeralSandbox: null,
		};
	}

	return {
		maxCpuPerSandbox:
			quota?.maxCpuPerSandbox ?? organizationLimits.maxCpuPerSandbox,
		maxMemoryPerSandbox:
			quota?.maxMemoryPerSandbox ?? organizationLimits.maxMemoryPerSandbox,
		maxDiskPerSandbox:
			quota?.maxDiskPerSandbox ?? organizationLimits.maxDiskPerSandbox,
		maxDiskPerNonEphemeralSandbox: quota?.maxDiskPerNonEphemeralSandbox ?? null,
	};
}
