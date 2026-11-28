/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { countLabel } from '../../common/utils/count-label.util';
import { addDays } from '../../common/utils/time.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import type { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import {
	FIRST_QUOTA_TIER,
	NO_QUOTA_TIER,
	QUOTA_TIER_TRAILING_WINDOW_DAYS,
} from '../constants/organization-quota-tier.constants';
import { OrganizationQuota } from '../entities/organization-quota.entity';
import type {
	QuotaTier,
	QuotaTierClassLimits,
	QuotaTierLimitKey,
	QuotaTierStanding,
} from '../types/quota-tier.types';

type TierStanding = Omit<QuotaTierStanding, 'organizationId'>;

export function sortedTiers(tiers: readonly QuotaTier[]): QuotaTier[] {
	return [...tiers].sort((left, right) => left.tier - right.tier);
}

function findTier(tiers: readonly QuotaTier[], tier: number): QuotaTier | null {
	return tiers.find((candidate) => candidate.tier === tier) ?? null;
}

function meetsTier(tier: QuotaTier, standing: TierStanding): boolean {
	return (
		(!tier.requiresVerifiedEmail || standing.verifiedEmail) &&
		standing.lifetimeDeposits.atLeast(
			MicroUsd.fromCents(tier.lifetimeDepositCents)
		) &&
		standing.trailingDeposits.atLeast(
			MicroUsd.fromCents(tier.trailingDepositCents)
		)
	);
}

function isTrailingTier(tier: QuotaTier): boolean {
	return tier.trailingDepositCents > 0;
}

function qualifiedTier(
	tiers: readonly QuotaTier[],
	standing: TierStanding
): number {
	return tiers.reduce(
		(highest, tier) =>
			meetsTier(tier, standing) ? Math.max(highest, tier.tier) : highest,
		NO_QUOTA_TIER
	);
}

function retainedTier(tiers: readonly QuotaTier[], heldTier: number): number {
	return tiers.reduce(
		(highest, tier) =>
			tier.tier <= heldTier && !isTrailingTier(tier)
				? Math.max(highest, tier.tier)
				: highest,
		NO_QUOTA_TIER
	);
}

export function earnedTier(
	tiers: readonly QuotaTier[],
	heldTier: number,
	standing: TierStanding
): number {
	return Math.max(
		qualifiedTier(tiers, standing),
		retainedTier(tiers, heldTier)
	);
}

export function nextTier(
	tiers: readonly QuotaTier[],
	currentTier: number
): QuotaTier | null {
	return (
		sortedTiers(tiers).find((candidate) => candidate.tier > currentTier) ?? null
	);
}

export function tierClassLimits(
	tiers: readonly QuotaTier[],
	tier: number,
	sandboxClass: SandboxClass
): QuotaTierClassLimits | null {
	return (
		findTier(tiers, tier)?.classLimits.find(
			(limits) => limits.sandboxClass === sandboxClass
		) ?? null
	);
}

export function tieredSandboxClasses(
	tiers: readonly QuotaTier[]
): SandboxClass[] {
	return [
		...new Set(
			tiers.flatMap((tier) =>
				tier.classLimits.map((limits) => limits.sandboxClass)
			)
		),
	];
}

export function emptyTierLimits(
	sandboxClass: SandboxClass
): QuotaTierClassLimits {
	return {
		sandboxClass,
		totalCpu: 0,
		totalMemory: 0,
		totalDisk: 0,
		totalGpu: 0,
		maxCpuPerSandbox: 0,
		maxMemoryPerSandbox: 0,
		maxDiskPerSandbox: 0,
	};
}

export function quotaTierInconsistency(
	tiers: readonly QuotaTier[]
): string | null {
	const ordered = sortedTiers(tiers);
	for (const [index, tier] of ordered.entries()) {
		if (tier.tier !== FIRST_QUOTA_TIER + index) {
			return `quotaTiers must be numbered from ${FIRST_QUOTA_TIER} without gaps`;
		}
		const classes = tier.classLimits.map((limits) => limits.sandboxClass);
		if (new Set(classes).size !== classes.length) {
			return `quotaTiers tier ${tier.tier} lists a sandbox class twice`;
		}
	}
	return null;
}

export function trailingWindowStart(now: Date): Date {
	return addDays(now, -QUOTA_TIER_TRAILING_WINDOW_DAYS);
}

const LIMIT_UNITS = {
	totalCpu: (amount) => `${countLabel(amount, 'vCPU')} in total`,
	totalMemory: (amount) => `${amount} GiB of memory in total`,
	totalDisk: (amount) => `${amount} GiB of disk in total`,
	totalGpu: (amount) => `${countLabel(amount, 'GPU')} in total`,
	maxCpuPerSandbox: (amount) => `${countLabel(amount, 'vCPU')} per sandbox`,
	maxMemoryPerSandbox: (amount) => `${amount} GiB of memory per sandbox`,
	maxDiskPerSandbox: (amount) => `${amount} GiB of disk per sandbox`,
} as const satisfies Record<QuotaTierLimitKey, (amount: number) => string>;

export function describeTierLimit(
	limit: QuotaTierLimitKey,
	amount: number
): string {
	return LIMIT_UNITS[limit](amount);
}

export function tierUnlockRequirement(
	tier: QuotaTier,
	standing: TierStanding
): string {
	if (tier.requiresVerifiedEmail && !standing.verifiedEmail) {
		return "Verify the owner's email address";
	}
	const lifetimeShort = MicroUsd.fromCents(tier.lifetimeDepositCents)
		.subtract(standing.lifetimeDeposits)
		.nonnegative();
	const trailingShort = MicroUsd.fromCents(tier.trailingDepositCents)
		.subtract(standing.trailingDeposits)
		.nonnegative();
	if (trailingShort.isPositive()) {
		return `Deposit ${trailingShort.max(lifetimeShort).toUsd()} USDC more within ${QUOTA_TIER_TRAILING_WINDOW_DAYS} days`;
	}
	return `Deposit ${lifetimeShort.toUsd()} USDC more`;
}

function raised(tierAmount: number, customAmount: number | null): number {
	return Math.max(tierAmount, customAmount ?? 0);
}

export function effectiveQuota(
	organizationId: string,
	tier: QuotaTierClassLimits,
	custom: OrganizationQuota | null
): OrganizationQuota {
	return new OrganizationQuota({
		organizationId,
		sandboxClass: tier.sandboxClass,
		totalCpuQuota: raised(tier.totalCpu, custom?.totalCpuQuota ?? null),
		totalMemoryQuota: raised(
			tier.totalMemory,
			custom?.totalMemoryQuota ?? null
		),
		totalDiskQuota: raised(tier.totalDisk, custom?.totalDiskQuota ?? null),
		totalGpuQuota: raised(tier.totalGpu, custom?.totalGpuQuota ?? null),
		allowedGpuTypes: custom?.allowedGpuTypes ?? null,
		maxCpuPerSandbox: raised(
			tier.maxCpuPerSandbox,
			custom?.maxCpuPerSandbox ?? null
		),
		maxMemoryPerSandbox: raised(
			tier.maxMemoryPerSandbox,
			custom?.maxMemoryPerSandbox ?? null
		),
		maxDiskPerSandbox: raised(
			tier.maxDiskPerSandbox,
			custom?.maxDiskPerSandbox ?? null
		),
		maxDiskPerNonEphemeralSandbox:
			custom?.maxDiskPerNonEphemeralSandbox ?? null,
		maxCpuPerGpuSandbox: custom?.maxCpuPerGpuSandbox ?? null,
		maxMemoryPerGpuSandbox: custom?.maxMemoryPerGpuSandbox ?? null,
		maxDiskPerGpuSandbox: custom?.maxDiskPerGpuSandbox ?? null,
	});
}
