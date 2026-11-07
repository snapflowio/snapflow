/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_MINUTE } from '../../common/constants/time.constants';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';

export const SETTINGS_ID = 1;
export const SETTINGS_RESOURCE_VERSION_INITIAL = 1;

export const DrainingMode = {
	MIGRATE: 'migrate',
	ARCHIVE: 'archive',
} as const;
export type DrainingMode = (typeof DrainingMode)[keyof typeof DrainingMode];

export const SETTINGS_WAKE = {
	topic: 'settings',
	id: 'current',
} as const;

export const SETTINGS_CACHE_MAX_AGE_MILLISECONDS = MILLISECONDS_PER_MINUTE;

export const SettingsEvents = {
	CHANGED: 'settings.changed',
} as const;

export const SETTINGS_PROBLEM_CODE = {
	VERSION_CONFLICT: 'SETTINGS_VERSION_CONFLICT',
	NOT_CONFIGURED: 'SETTING_NOT_CONFIGURED',
} as const;

export const EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM = 64;

export const SETTINGS_POSITIVE_MINIMUM = 1;

// Hosts keep their whole price; the markup is added on top for the customer,
// higher on Verified machines, whose checks cost more to run. A private pool
// pays a flat monthly fee per machine instead.
const DEFAULT_FEE_SETTINGS = {
	standardMarkupBasisPoints: 2_000,
	verifiedMarkupBasisPoints: 3_000,
	privatePoolMachineMonthlyMicroUsd: 5_000_000,
} as const;

// Sanity limits on what a host may charge per resource, micro-USD; the disk
// limits apply to running and stopped disk alike.
const DEFAULT_PRICE_LIMIT_SETTINGS = {
	vcpuHourPriceMinimumMicroUsd: 1_000,
	vcpuHourPriceMaximumMicroUsd: 500_000,
	memoryGibHourPriceMinimumMicroUsd: 500,
	memoryGibHourPriceMaximumMicroUsd: 100_000,
	gpuHourPriceMinimumMicroUsd: 50_000,
	gpuHourPriceMaximumMicroUsd: 20_000_000,
	diskGibMonthPriceMinimumMicroUsd: 10_000,
	diskGibMonthPriceMaximumMicroUsd: 1_000_000,
} as const;

const DEFAULT_MARKETPLACE_SETTINGS = {
	priceFloorBasisPoints: 2_500,
	priceFloorMinimumSamples: 5,
	priceLockDays: 30,
	leaseRenewalGraceDays: 7,
	stoppedSandboxRetentionDays: 30,
	pinnedStartWaitMinutes: 60,
	egressPriceCeilingMicroUsdPerGiB: 100_000,
	egressCeilingMedianBasisPoints: 40_000,
	networkBudgetThrottleBandwidthBps: 10_000_000,
	exposureCeilingProbationaryCents: 1_000,
	exposureCeilingEstablishedCents: 10_000,
	exposureCeilingHostCents: 50_000,
} as const;

const DEFAULT_VERIFICATION_SETTINGS = {
	listingMinimumDownlinkMbps: 200,
	listingMinimumUplinkMbps: 100,
	listingMinimumDiskRandomReadIops: 20_000,
	listingMinimumDiskSequentialMibps: 500,
	verifiedMinimumListedDays: 30,
	verifiedMinimumUptimeBasisPoints: 9_900,
	verifiedMinimumSpotChecks: 2,
	spotCheckIntervalHoursCommunity: 24,
	spotCheckIntervalHoursVerified: 168,
	spotCheckMonthlyBudgetCents: 5_000,
	spotCheckToleranceBasisPoints: 2_000,
	spotCheckOrganizationId: null,
} as const;

// A voucher a minute keeps a host at most two minutes of usage away from a
// signed payment; a day-long voucher survives a long API outage, and claiming
// hourly keeps gas low while vouchers stay far from expiry.
const DEFAULT_VOUCHER_SETTINGS = {
	voucherIntervalSeconds: 60,
	voucherGraceIntervals: 2,
	voucherLifetimeHours: 24,
	claimIntervalMinutes: 60,
} as const;

export const SETTINGS_FIRST_RUN_ACTOR_ID = 'settings-first-run';

const DEFAULT_ORGANIZATION_QUOTA = {
	totalCpuQuota: 10,
	totalMemoryQuota: 10,
	totalDiskQuota: 30,
	maxCpuPerSandbox: 4,
	maxMemoryPerSandbox: 8,
	maxDiskPerSandbox: 10,
	snapshotQuota: 30,
	maxSnapshotSize: 20,
	volumeQuota: 100,
} as const;

export const SETTINGS_DEFAULTS = {
	defaultSnapshot: null,
	defaultSandboxClass: SandboxClass.LINUX_VM,
	sandboxDefaultLimitedNetworkEgress: false,
	...DEFAULT_ORGANIZATION_QUOTA,
	machineGuestRegistryUrl: null,
	machineDesktopEnabled: false,
	machineSerialConsoleEnabled: false,
	publicIngressEnabled: false,
	...DEFAULT_FEE_SETTINGS,
	...DEFAULT_PRICE_LIMIT_SETTINGS,
	...DEFAULT_MARKETPLACE_SETTINGS,
	...DEFAULT_VERIFICATION_SETTINGS,
	// About three minutes of 2-second Base blocks, in line with how long
	// Circle waits before it recognizes Base USDC transfers; deep enough that
	// the indexer never credits a deposit the sequencer later reorgs away.
	settlementConfirmations: 90,
	...DEFAULT_VOUCHER_SETTINGS,
	maintenanceMode: false,
	drainingMode: DrainingMode.MIGRATE,
	drainingForce: false,
} as const;
