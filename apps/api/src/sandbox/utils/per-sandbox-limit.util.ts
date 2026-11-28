/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { getEffectivePerSandboxLimits } from '../../organization/utils/sandbox-limits.util';
import type { PerSandboxResource } from '../constants/resource-limit-messages.constants';

export type PerSandboxLimits = ReturnType<typeof getEffectivePerSandboxLimits>;

export type PerSandboxRequest = Partial<Record<PerSandboxResource, number>>;

export interface PerSandboxViolation {
	resource: PerSandboxResource;
	requested: number;
	maximum: number;
}

const PER_SANDBOX_LIMIT_FIELD = {
	cpu: 'maxCpuPerSandbox',
	memory: 'maxMemoryPerSandbox',
	disk: 'maxDiskPerSandbox',
} as const satisfies Record<PerSandboxResource, keyof PerSandboxLimits>;

const PER_SANDBOX_RESOURCES: readonly PerSandboxResource[] = [
	'cpu',
	'memory',
	'disk',
];

export function perSandboxViolation(
	request: PerSandboxRequest,
	limits: PerSandboxLimits
): PerSandboxViolation | null {
	for (const resource of PER_SANDBOX_RESOURCES) {
		const requested = request[resource];
		const maximum = limits[PER_SANDBOX_LIMIT_FIELD[resource]];
		if (requested !== undefined && requested > maximum) {
			return { resource, requested, maximum };
		}
	}
	return null;
}
