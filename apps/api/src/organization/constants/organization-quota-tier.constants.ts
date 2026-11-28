/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CronExpression } from '@nestjs/schedule';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import type { QuotaTier } from '../types/quota-tier.types';

export const NO_QUOTA_TIER = 0;
export const FIRST_QUOTA_TIER = 1;
export const QUOTA_TIERS_MAXIMUM = 16;
export const QUOTA_TIER_TRAILING_WINDOW_DAYS = 30;

const CENTS_PER_USD = 100;
const TIER_2_LIFETIME_DEPOSIT_USD = 25;
const TIER_3_LIFETIME_DEPOSIT_USD = 500;
const TIER_4_TRAILING_DEPOSIT_USD = 2_000;

export const DEFAULT_QUOTA_TIERS: readonly QuotaTier[] = [
	{
		tier: 1,
		requiresVerifiedEmail: true,
		lifetimeDepositCents: 0,
		trailingDepositCents: 0,
		classLimits: [
			{
				sandboxClass: SandboxClass.LINUX_VM,
				totalCpu: 10,
				totalMemory: 10,
				totalDisk: 30,
				totalGpu: 0,
				maxCpuPerSandbox: 4,
				maxMemoryPerSandbox: 8,
				maxDiskPerSandbox: 10,
			},
		],
	},
	{
		tier: 2,
		requiresVerifiedEmail: true,
		lifetimeDepositCents: TIER_2_LIFETIME_DEPOSIT_USD * CENTS_PER_USD,
		trailingDepositCents: 0,
		classLimits: [
			{
				sandboxClass: SandboxClass.LINUX_VM,
				totalCpu: 100,
				totalMemory: 200,
				totalDisk: 300,
				totalGpu: 1,
				maxCpuPerSandbox: 16,
				maxMemoryPerSandbox: 64,
				maxDiskPerSandbox: 100,
			},
		],
	},
	{
		tier: 3,
		requiresVerifiedEmail: true,
		lifetimeDepositCents: TIER_3_LIFETIME_DEPOSIT_USD * CENTS_PER_USD,
		trailingDepositCents: 0,
		classLimits: [
			{
				sandboxClass: SandboxClass.LINUX_VM,
				totalCpu: 250,
				totalMemory: 500,
				totalDisk: 2_000,
				totalGpu: 4,
				maxCpuPerSandbox: 32,
				maxMemoryPerSandbox: 128,
				maxDiskPerSandbox: 250,
			},
		],
	},
	{
		tier: 4,
		requiresVerifiedEmail: true,
		lifetimeDepositCents: TIER_3_LIFETIME_DEPOSIT_USD * CENTS_PER_USD,
		trailingDepositCents: TIER_4_TRAILING_DEPOSIT_USD * CENTS_PER_USD,
		classLimits: [
			{
				sandboxClass: SandboxClass.LINUX_VM,
				totalCpu: 500,
				totalMemory: 1_000,
				totalDisk: 5_000,
				totalGpu: 8,
				maxCpuPerSandbox: 64,
				maxMemoryPerSandbox: 256,
				maxDiskPerSandbox: 500,
			},
		],
	},
];

export const QUOTA_TIER_SWEEP = {
	expression: CronExpression.EVERY_10_MINUTES,
	jobName: 'evaluate-organization-quota-tiers',
	batchSize: 500,
} as const;

export const QuotaTierEvents = {
	EVALUATE: 'organization.quota-tier.evaluate',
} as const;

export const LimitsNoticeEvents = {
	NOTICE: 'limits.notice',
} as const;

export const LimitsNoticeKind = {
	TIER_UPGRADED: 'tier_upgraded',
	INCREASE_APPROVED: 'increase_approved',
	INCREASE_DENIED: 'increase_denied',
	STORAGE_CAP_REACHED: 'storage_cap_reached',
} as const;

export type LimitsNoticeKind =
	(typeof LimitsNoticeKind)[keyof typeof LimitsNoticeKind];

export const LIMITS_PAGE_PATH = '/settings/limits';

export const QUOTA_INCREASE_REQUEST = {
	useCaseMinimumLength: 20,
	useCaseMaximumLength: 2_000,
	decisionReasonMaximumLength: 1_000,
	historyLimit: 50,
} as const;
