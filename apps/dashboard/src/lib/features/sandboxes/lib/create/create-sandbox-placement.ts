/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type OrganizationUsageOverview,
	SandboxClass,
	SandboxMode,
	type SnapshotDto,
} from '@snapflow/api-client';
import { getGpuOptions } from '#lib/features/machines/lib/gpu-options.ts';
import { type CreateSandboxValues, SOURCE } from './create-sandbox-schema.ts';

export type CreateSandboxFieldCorrections = Partial<
	Pick<CreateSandboxValues, 'gpu' | 'gpuType' | 'mode'>
>;

export function snapshotNamed(
	snapshots: readonly SnapshotDto[],
	name: string
): SnapshotDto | undefined {
	return snapshots.find((snapshot) => snapshot.name === name);
}

function linuxVmUsage(usage: OrganizationUsageOverview | undefined) {
	return usage?.quotaUsage.find(
		(quotaUsage) => quotaUsage.sandboxClass === SandboxClass.LinuxVm
	);
}

export function gpuOptionsFor(usage: OrganizationUsageOverview | undefined) {
	return getGpuOptions(linuxVmUsage(usage)?.allowedGpuTypes);
}

export function gpuAvailableFor(
	usage: OrganizationUsageOverview | undefined
): boolean {
	return (
		(linuxVmUsage(usage)?.totalGpuQuota ?? 0) > 0 &&
		gpuOptionsFor(usage).length > 0
	);
}

export function fieldCorrectionsFor(
	usage: OrganizationUsageOverview | undefined,
	values: CreateSandboxValues
): CreateSandboxFieldCorrections {
	const corrections: CreateSandboxFieldCorrections = {};
	if (!(values.source === SOURCE.IMAGE && gpuAvailableFor(usage))) {
		if (values.gpu) corrections.gpu = false;
		if (values.gpuType) corrections.gpuType = '';
		return corrections;
	}
	if (!values.gpu) return corrections;
	if (values.mode !== SandboxMode.Standard) {
		corrections.mode = SandboxMode.Standard;
	}
	const gpuOptions = gpuOptionsFor(usage);
	const [firstGpuOption] = gpuOptions;
	if (
		firstGpuOption &&
		!gpuOptions.some((option) => option.value === values.gpuType)
	) {
		corrections.gpuType = firstGpuOption.value;
	}
	return corrections;
}
