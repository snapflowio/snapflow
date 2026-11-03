/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	OrganizationQuota,
	UpdateOrganizationLimits,
} from '@snapflow/api-client';
import type { OrganizationQuotaValues } from '#lib/api/admin/organizations.ts';
import type { QuantityField } from '#lib/features/admin/lib/quantity-form.svelte.ts';
import type { KeysOfType } from '#lib/utils/type-utils.ts';

export const ORGANIZATION_LIMIT_FIELDS: readonly QuantityField<
	KeysOfType<UpdateOrganizationLimits, number>
>[] = [
	{ name: 'maxCpuPerSandbox', label: 'CPU per sandbox', unit: 'vCPUs' },
	{ name: 'maxMemoryPerSandbox', label: 'Memory per sandbox', unit: 'GiB' },
	{ name: 'maxDiskPerSandbox', label: 'Disk per sandbox', unit: 'GiB' },
	{ name: 'snapshotQuota', label: 'Snapshots', unit: 'count' },
	{ name: 'maxSnapshotSize', label: 'Snapshot size', unit: 'GiB' },
	{ name: 'volumeQuota', label: 'Volumes', unit: 'count' },
];

export const QUOTA_TOTAL_FIELDS: readonly QuantityField<
	KeysOfType<Required<OrganizationQuotaValues>, number>
>[] = [
	{ name: 'totalCpuQuota', label: 'Total CPU', unit: 'vCPUs' },
	{ name: 'totalMemoryQuota', label: 'Total memory', unit: 'GiB' },
	{ name: 'totalDiskQuota', label: 'Total disk', unit: 'GiB' },
	{ name: 'totalGpuQuota', label: 'Total GPUs', unit: 'count' },
];

export const QUOTA_LIMIT_FIELDS = [
	{ name: 'maxCpuPerSandbox', label: 'CPU per sandbox', unit: 'vCPUs' },
	{ name: 'maxMemoryPerSandbox', label: 'Memory per sandbox', unit: 'GiB' },
	{ name: 'maxDiskPerSandbox', label: 'Disk per sandbox', unit: 'GiB' },
	{
		name: 'maxDiskPerNonEphemeralSandbox',
		label: 'Disk per persistent sandbox',
		unit: 'GiB',
	},
] as const satisfies readonly QuantityField<keyof OrganizationQuotaValues>[];

const NO_LIMIT = 'no limit';

function limitLabel(value: number | null, unit: string): string {
	return value === null ? NO_LIMIT : `${value} ${unit}`;
}

export function quotaSummary(quota: OrganizationQuota): string {
	return `${quota.totalCpuQuota} vCPUs · ${quota.totalMemoryQuota} GiB memory · ${quota.totalDiskQuota} GiB disk · ${quota.totalGpuQuota} GPUs`;
}

export function quotaLimitSummary(quota: OrganizationQuota): string {
	return QUOTA_LIMIT_FIELDS.map(
		(field) => `${field.label}: ${limitLabel(quota[field.name], field.unit)}`
	).join(' · ');
}
