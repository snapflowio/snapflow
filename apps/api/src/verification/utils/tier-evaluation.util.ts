/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MACHINE_TIER_ORDER } from '../../marketplace/constants/marketplace.constants';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import type { SettingsSnapshot } from '../../settings/types/settings.types';
import {
	TIER_REASON,
	type TierReason,
} from '../constants/machine-tier.constants';

export type TierPolicy = Pick<
	SettingsSnapshot,
	| 'verifiedMinimumListedDays'
	| 'verifiedMinimumUptimeBasisPoints'
	| 'verifiedMinimumSpotChecks'
>;

export type ListingMinimumPolicy = Pick<
	SettingsSnapshot,
	| 'listingMinimumDownlinkMbps'
	| 'listingMinimumUplinkMbps'
	| 'listingMinimumDiskRandomReadIops'
	| 'listingMinimumDiskSequentialMibps'
>;

export interface MeasuredListingFacts {
	networkDownlinkMbps: number | null;
	networkUplinkMbps: number | null;
	diskRandomReadIops: number | null;
	diskSequentialMibps: number | null;
}

export interface TierEvaluationInput {
	listingPublic: boolean;
	payoutWalletReady: boolean;
	benchmarkPassed: boolean;
	inventoryCurrent: boolean;
	fingerprintConflict: boolean;
	networkMinimumMet: boolean;
	diskMinimumMet: boolean;
	restricted: boolean;
	listedDays: number;
	uptimeBasisPoints: number;
	spotChecksPassed: number;
	spotChecksFailed: number;
	datacenterApproved: boolean;
	adminTierCap: MachineTier | null;
}

export interface TierEvaluation {
	tier: MachineTier;
	reasons: TierReason[];
}

function atLeast(value: number | null, minimum: number): boolean {
	return value !== null && value >= minimum;
}

export function networkMinimumMet(
	facts: MeasuredListingFacts,
	policy: ListingMinimumPolicy
): boolean {
	return (
		atLeast(facts.networkDownlinkMbps, policy.listingMinimumDownlinkMbps) &&
		atLeast(facts.networkUplinkMbps, policy.listingMinimumUplinkMbps)
	);
}

export function diskMinimumMet(
	facts: MeasuredListingFacts,
	policy: ListingMinimumPolicy
): boolean {
	return (
		atLeast(
			facts.diskRandomReadIops,
			policy.listingMinimumDiskRandomReadIops
		) &&
		atLeast(facts.diskSequentialMibps, policy.listingMinimumDiskSequentialMibps)
	);
}

interface TierRequirement {
	satisfied: boolean;
	reason: TierReason;
}

function unmet(requirements: readonly TierRequirement[]): TierReason[] {
	return requirements
		.filter((requirement) => !requirement.satisfied)
		.map((requirement) => requirement.reason);
}

export function communityReasons(input: TierEvaluationInput): TierReason[] {
	return unmet([
		{ satisfied: input.listingPublic, reason: TIER_REASON.LISTING_NOT_PUBLIC },
		{
			satisfied: input.payoutWalletReady,
			reason: TIER_REASON.PAYOUT_WALLET_REQUIRED,
		},
		{ satisfied: input.benchmarkPassed, reason: TIER_REASON.BENCHMARK_MISSING },
		{
			satisfied: input.inventoryCurrent,
			reason: TIER_REASON.INVENTORY_CHANGED,
		},
		{
			satisfied: !input.fingerprintConflict,
			reason: TIER_REASON.FINGERPRINT_CONFLICT,
		},
		{
			satisfied: input.networkMinimumMet,
			reason: TIER_REASON.NETWORK_BELOW_MINIMUM,
		},
		{ satisfied: input.diskMinimumMet, reason: TIER_REASON.DISK_BELOW_MINIMUM },
		{ satisfied: !input.restricted, reason: TIER_REASON.RESTRICTED },
	]);
}

export function verifiedReasons(
	input: TierEvaluationInput,
	policy: TierPolicy
): TierReason[] {
	return unmet([
		{
			satisfied: input.listedDays >= policy.verifiedMinimumListedDays,
			reason: TIER_REASON.LISTED_DAYS,
		},
		{
			satisfied:
				input.uptimeBasisPoints >= policy.verifiedMinimumUptimeBasisPoints,
			reason: TIER_REASON.UPTIME,
		},
		{
			satisfied: input.spotChecksPassed >= policy.verifiedMinimumSpotChecks,
			reason: TIER_REASON.SPOT_CHECKS_MISSING,
		},
		{
			satisfied: input.spotChecksFailed === 0,
			reason: TIER_REASON.SPOT_CHECK_FAILED,
		},
	]);
}

function earnedTier(
	input: TierEvaluationInput,
	policy: TierPolicy
): TierEvaluation {
	const community = communityReasons(input);
	if (community.length > 0) {
		return { tier: MachineTier.PRIVATE, reasons: community };
	}
	const verified = verifiedReasons(input, policy);
	if (verified.length > 0) {
		return { tier: MachineTier.COMMUNITY, reasons: verified };
	}
	if (!input.datacenterApproved) {
		return {
			tier: MachineTier.VERIFIED,
			reasons: [TIER_REASON.DATACENTER_NOT_APPROVED],
		};
	}
	return { tier: MachineTier.DATACENTER, reasons: [] };
}

export function tierAtMost(tier: MachineTier, cap: MachineTier): boolean {
	return MACHINE_TIER_ORDER.indexOf(tier) <= MACHINE_TIER_ORDER.indexOf(cap);
}

export function evaluateMachineTier(
	input: TierEvaluationInput,
	policy: TierPolicy
): TierEvaluation {
	const earned = earnedTier(input, policy);
	const cap = input.adminTierCap;
	if (cap === null || tierAtMost(earned.tier, cap)) return earned;
	return { tier: cap, reasons: [TIER_REASON.ADMIN_CAP, ...earned.reasons] };
}
