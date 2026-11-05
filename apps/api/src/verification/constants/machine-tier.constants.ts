/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const TIER_REASON = {
	LISTING_NOT_PUBLIC: 'listing_not_public',
	KYC_INCOMPLETE: 'kyc_incomplete',
	BENCHMARK_MISSING: 'benchmark_missing',
	INVENTORY_CHANGED: 'inventory_changed',
	FINGERPRINT_CONFLICT: 'fingerprint_conflict',
	NETWORK_BELOW_MINIMUM: 'network_below_minimum',
	DISK_BELOW_MINIMUM: 'disk_below_minimum',
	RESTRICTED: 'restricted',
	LISTED_DAYS: 'listed_days_below_minimum',
	UPTIME: 'uptime_below_minimum',
	SPOT_CHECKS_MISSING: 'spot_checks_below_minimum',
	SPOT_CHECK_FAILED: 'spot_check_failed',
	DATACENTER_NOT_APPROVED: 'datacenter_not_approved',
	ADMIN_CAP: 'admin_tier_cap',
} as const;

export type TierReason = (typeof TIER_REASON)[keyof typeof TIER_REASON];

export const MACHINE_TIER_JOB = {
	EVALUATE: 'evaluate-machine-tiers',
} as const;

export const MACHINE_TIER_POLICY = {
	EVALUATION_WINDOW_DAYS: 30,
	BATCH_SIZE: 200,
} as const;
