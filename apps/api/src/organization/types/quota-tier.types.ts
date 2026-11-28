/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../common/values/micro-usd.value';
import type { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';

export interface QuotaTierClassLimits {
	sandboxClass: SandboxClass;
	totalCpu: number;
	totalMemory: number;
	totalDisk: number;
	totalGpu: number;
	maxCpuPerSandbox: number;
	maxMemoryPerSandbox: number;
	maxDiskPerSandbox: number;
}

export interface QuotaTier {
	tier: number;
	requiresVerifiedEmail: boolean;
	lifetimeDepositCents: number;
	trailingDepositCents: number;
	classLimits: QuotaTierClassLimits[];
}

export type QuotaTierLimitKey = Exclude<
	keyof QuotaTierClassLimits,
	'sandboxClass'
>;

export interface QuotaTierStanding {
	organizationId: string;
	verifiedEmail: boolean;
	lifetimeDeposits: MicroUsd;
	trailingDeposits: MicroUsd;
}
