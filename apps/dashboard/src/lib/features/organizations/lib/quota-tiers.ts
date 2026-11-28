/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	OrganizationQuotaTier,
	QuotaTier,
	QuotaTierClassLimits,
} from '@snapflow/api-client';
import type { KeysOfType } from '#lib/utils/type-utils.ts';
import { formatUsd, MICRO_USD_PER_CENT } from '#lib/utils/usd.ts';

export const NO_QUOTA_TIER = 0;

type TierLimitKey = KeysOfType<QuotaTierClassLimits, number>;

interface TierLimitColumn {
	label: string;
	unit: string;
	total: TierLimitKey;
	perSandbox?: TierLimitKey;
}

export interface TierLimitCell {
	label: string;
	total: string;
	perSandbox: string | null;
}

const TIER_LIMIT_COLUMNS: readonly TierLimitColumn[] = [
	{
		label: 'vCPUs',
		unit: '',
		total: 'totalCpu',
		perSandbox: 'maxCpuPerSandbox',
	},
	{
		label: 'Memory',
		unit: ' GiB',
		total: 'totalMemory',
		perSandbox: 'maxMemoryPerSandbox',
	},
	{
		label: 'Disk',
		unit: ' GiB',
		total: 'totalDisk',
		perSandbox: 'maxDiskPerSandbox',
	},
	{ label: 'GPUs', unit: '', total: 'totalGpu' },
];

export function tierLimitCells(limits: QuotaTierClassLimits): TierLimitCell[] {
	return TIER_LIMIT_COLUMNS.map((column) => ({
		label: column.label,
		total: `${limits[column.total]}${column.unit}`,
		perSandbox: column.perSandbox
			? `${limits[column.perSandbox]}${column.unit} / sandbox`
			: null,
	}));
}

export interface TierProgress {
	tier: QuotaTier;
	depositedMicroUsd: string;
	requiredMicroUsd: string;
	trailing: boolean;
	emailMissing: boolean;
}

export function tierLabel(tier: number): string {
	return tier === NO_QUOTA_TIER ? 'No tier' : `Tier ${tier}`;
}

export function centsToMicroUsd(cents: number): string {
	return (BigInt(cents) * MICRO_USD_PER_CENT).toString();
}

export function tierRequirements(
	tier: QuotaTier,
	trailingWindowDays: number
): string[] {
	const requirements: string[] = [];
	if (tier.requiresVerifiedEmail) requirements.push('Verified email');
	if (tier.lifetimeDepositCents > 0) {
		requirements.push(
			`${formatUsd(centsToMicroUsd(tier.lifetimeDepositCents))} deposited in total`
		);
	}
	if (tier.trailingDepositCents > 0) {
		requirements.push(
			`${formatUsd(centsToMicroUsd(tier.trailingDepositCents))} deposited every ${trailingWindowDays} days`
		);
	}
	return requirements;
}

export function nextTierProgress(
	standing: OrganizationQuotaTier
): TierProgress | null {
	const tier = standing.tiers.find(
		(candidate) => candidate.tier === standing.nextTier
	);
	if (!tier) return null;
	const trailing = tier.trailingDepositCents > 0;
	return {
		tier,
		trailing,
		emailMissing: tier.requiresVerifiedEmail && !standing.verifiedEmail,
		depositedMicroUsd: trailing
			? standing.trailingDepositMicroUsd
			: standing.lifetimeDepositMicroUsd,
		requiredMicroUsd: centsToMicroUsd(
			trailing ? tier.trailingDepositCents : tier.lifetimeDepositCents
		),
	};
}

export function remainingMicroUsd(progress: TierProgress): string {
	const remaining =
		BigInt(progress.requiredMicroUsd) - BigInt(progress.depositedMicroUsd);
	return (remaining > 0n ? remaining : 0n).toString();
}
