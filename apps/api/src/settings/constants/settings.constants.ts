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

export const ISO_WEEKDAY = {
	MONDAY: 1,
	SUNDAY: 7,
} as const;

const DEFAULT_TOP_UP_PRESETS_CENTS: number[] = [
	1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000,
];

const DEFAULT_PAYOUT_COUNTRIES: string[] = [
	'US',
	'GB',
	'CA',
	'CH',
	'AT',
	'BE',
	'BG',
	'HR',
	'CY',
	'CZ',
	'DK',
	'EE',
	'FI',
	'FR',
	'DE',
	'GR',
	'HU',
	'IS',
	'IE',
	'IT',
	'LV',
	'LI',
	'LT',
	'LU',
	'MT',
	'NL',
	'NO',
	'PL',
	'PT',
	'RO',
	'SK',
	'SI',
	'ES',
	'SE',
];

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

const DEFAULT_PAYMENT_SETTINGS = {
	topUpMinimumCents: 1_000,
	topUpMaximumCents: 100_000,
	topUpPresetsCents: DEFAULT_TOP_UP_PRESETS_CENTS,
	autoTopUpMinimumCents: 2_500,
	autoTopUpMinimumIntervalMinutes: 60,
	topUpAttemptsPerHour: 5,
	paymentMethodsPerDay: 3,
	organizationsPerCardFingerprint: 2,
	payoutMinimumCents: 5_000,
	payoutWeekday: ISO_WEEKDAY.MONDAY,
	payoutHoldCommunityDays: 14,
	payoutHoldVerifiedDays: 7,
	payoutHoldDatacenterDays: 3,
	newFundingHoldDays: 30,
	stripeTaxEnabled: false,
	payoutCountries: DEFAULT_PAYOUT_COUNTRIES,
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
	platformMarkupBasisPoints: 2_500,
	...DEFAULT_MARKETPLACE_SETTINGS,
	...DEFAULT_VERIFICATION_SETTINGS,
	...DEFAULT_PAYMENT_SETTINGS,
	maintenanceMode: false,
	drainingMode: DrainingMode.MIGRATE,
	drainingForce: false,
} as const;
