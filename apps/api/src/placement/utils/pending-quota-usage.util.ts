/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SandboxResourceAmounts } from '../../organization/utils/organization-usage.util';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import type { PendingQuotaReservation } from '../../sandbox/types/sandbox-quota.types';

export type PendingQuotaUsage = Partial<SandboxResourceAmounts>;

export function sandboxQuotaUsage(
	sandbox: Pick<Sandbox, 'cpu' | 'mem' | 'disk' | 'gpu'>
): SandboxResourceAmounts {
	return {
		cpu: sandbox.cpu,
		memory: sandbox.mem,
		disk: sandbox.disk,
		gpu: sandbox.gpu,
	};
}

export function pendingQuotaUsage(
	reservation: PendingQuotaReservation,
	usage: SandboxResourceAmounts
): PendingQuotaUsage {
	return {
		cpu: reservation.pendingCpuIncremented ? usage.cpu : undefined,
		memory: reservation.pendingMemoryIncremented ? usage.memory : undefined,
		disk: reservation.pendingDiskIncremented ? usage.disk : undefined,
		gpu: reservation.pendingGpuIncremented ? usage.gpu : undefined,
	};
}
