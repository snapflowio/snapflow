/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AdminListing,
	AdminListingFlag,
	MachineTier,
} from '@snapflow/api-client';
import * as z from 'zod';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import {
	MACHINE_CATEGORY_LABELS,
	MACHINE_TIER_LABELS,
	MACHINE_TIER_ORDER,
} from '#lib/features/listings/lib/listing-format.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import {
	formatBasisPointsPercent,
	formatOptionalDateTime,
} from '#lib/utils/format.ts';

const NOT_BENCHMARKED_LABEL = 'Not benchmarked';
const NO_CAP_LABEL = 'None';
export const NOT_APPROVED_LABEL = 'Not approved';
const NOT_RESTRICTED_LABEL = 'No';

export const LISTING_SORT_OPTIONS = [
	{ id: 'tier', label: 'Tier' },
	{ id: 'measured', label: 'Measured' },
] as const;

export const LISTING_TIER_OPTIONS = MACHINE_TIER_ORDER.map((tier) => ({
	label: MACHINE_TIER_LABELS[tier],
	value: tier,
}));

export const LISTING_FILTER_KEYS = ['tier', 'flags'] as const;

export const LISTING_FLAG_LABELS = {
	[AdminListingFlag.Conflict]: 'Fingerprint conflict',
	[AdminListingFlag.Restricted]: 'Restricted',
	[AdminListingFlag.Clean]: 'No flags',
} as const satisfies Record<AdminListingFlag, string>;

export const listingsSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['tier', 'measured']),
	tier: searchParamArray(z.enum(MachineTier)).catch([]),
	flags: searchParamArray(z.enum(AdminListingFlag)).catch([]),
});

export function listingFlags(listing: AdminListing): string[] {
	return [
		listing.fingerprintConflict
			? LISTING_FLAG_LABELS[AdminListingFlag.Conflict]
			: null,
		listing.restrictedAt
			? [
					LISTING_FLAG_LABELS[AdminListingFlag.Restricted],
					listing.restrictionReason,
				]
					.filter(Boolean)
					.join(': ')
			: null,
	].filter((flag) => flag !== null);
}

export function listingCategoryLabel(listing: AdminListing): string {
	return listing.category
		? MACHINE_CATEGORY_LABELS[listing.category]
		: NOT_BENCHMARKED_LABEL;
}

export function listingTierCapLabel(listing: AdminListing): string {
	return listing.adminTierCap
		? MACHINE_TIER_LABELS[listing.adminTierCap]
		: NO_CAP_LABEL;
}

export function listingApprovalLabel(listing: AdminListing): string {
	return formatOptionalDateTime(
		listing.datacenterApprovedAt,
		NOT_APPROVED_LABEL
	);
}

export function listingRestrictionLabel(listing: AdminListing): string {
	return formatOptionalDateTime(listing.restrictedAt, NOT_RESTRICTED_LABEL);
}

export function listingUtilizationLabel(
	basisPoints: number | null
): string | null {
	return basisPoints === null ? null : formatBasisPointsPercent(basisPoints);
}

const TIER_REASON_LABELS: Readonly<Record<string, string>> = {
	listing_not_public: 'Listing not public',
	payout_wallet_required: 'Payout wallet required',
	benchmark_missing: 'Benchmark missing',
	benchmark_expired: 'Benchmark expired',
	inventory_changed: 'Inventory changed',
	fingerprint_conflict: 'Fingerprint conflict',
	network_below_minimum: 'Network below minimum',
	disk_below_minimum: 'Disk below minimum',
	restricted: 'Restricted',
	listed_days_below_minimum: 'Listed too few days',
	uptime_below_minimum: 'Uptime below minimum',
	spot_checks_below_minimum: 'Too few spot checks',
	spot_check_failed: 'Spot check failed',
	datacenter_not_approved: 'Datacenter not approved',
	admin_tier_cap: 'Admin tier cap',
};

export function tierReasonLabel(reason: string): string {
	return TIER_REASON_LABELS[reason] ?? reason.replaceAll('_', ' ');
}
