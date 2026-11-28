/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_MINUTE } from '../../common/constants/time.constants';
import { DEFAULT_QUOTA_TIERS } from '../../organization/constants/organization-quota-tier.constants';
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
	INVALID: 'SETTINGS_INVALID',
	MAINTENANCE: 'MAINTENANCE_MODE',
} as const;

export const EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM = 64;

export const SETTINGS_POSITIVE_MINIMUM = 1;

const DEFAULT_FEE_SETTINGS = {
	markupBasisPoints: 2_000,
} as const;

const DEFAULT_PRICING_SETTINGS = {
	storageMicroUsdPerGibMonth: 45_000,
	storageCapGibDefault: 1_000,
} as const;

export const AbuseEnforcementMode = {
	OBSERVE: 'observe',
	ENFORCE: 'enforce',
} as const;
export type AbuseEnforcementMode =
	(typeof AbuseEnforcementMode)[keyof typeof AbuseEnforcementMode];

const DEFAULT_TRAFFIC_SETTINGS = {
	sandboxUploadBandwidthLimitMbps: 20,
	sandboxDownloadBandwidthLimitMbps: 100,
	sandboxBurstMib: 128,
	sandboxPacketsPerSecondLimit: 25_000,
	sandboxNewConnectionsPerSecond: 50,
	sandboxMaxConnections: 4_096,
	sandboxHostLinkShareBasisPoints: 6_000,
	abuseEnforcementMode: AbuseEnforcementMode.OBSERVE,
} as const;

export const SANDBOX_BANDWIDTH_LIMIT_MBPS = {
	MINIMUM: 1,
	MAXIMUM: 32_000,
} as const;

export const SANDBOX_BURST_MIB = { MINIMUM: 0, MAXIMUM: 1_024 } as const;

export const SANDBOX_PACKETS_PER_SECOND = {
	MINIMUM: 1_000,
	MAXIMUM: 1_000_000,
} as const;

export const SANDBOX_NEW_CONNECTIONS_PER_SECOND = {
	MINIMUM: 1,
	MAXIMUM: 10_000,
} as const;

export const SANDBOX_MAX_CONNECTIONS = {
	MINIMUM: 64,
	MAXIMUM: 262_144,
} as const;

export const SANDBOX_HOST_LINK_SHARE_BASIS_POINTS = {
	MINIMUM: 1_000,
	MAXIMUM: 10_000,
} as const;

const DEFAULT_ARCHIVE_SETTINGS = {
	archiveAfterStoppedDaysDefault: 7,
	archiveAfterMachineOfflineMinutes: 60,
} as const;

export const ARCHIVE_AFTER_STOPPED_DAYS = { MINIMUM: 0, MAXIMUM: 30 } as const;

const DEFAULT_RELAY_FEE_SETTINGS = {
	relayFeeMarginBasisPoints: 2_000,
	walletFeeCapBasisPoints: 15_000,
} as const;

const DEFAULT_MARKETPLACE_SETTINGS = {
	priceLockDays: 30,
	startWaitMinutes: 60,
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

const DEFAULT_VOUCHER_SETTINGS = {
	voucherIntervalSeconds: 60,
	voucherGraceIntervals: 2,
	hostPayoutMinimumCents: 1_000,
} as const;

const BASE_BLOCKS_PER_MINUTE = 30;
const L1_BATCH_INCLUSION_MINUTES = 3;
const L1_FINALITY_MINUTES = 20;

const DEFAULT_DEPOSIT_CONFIRMATION_SETTINGS = {
	settlementConfirmations: L1_BATCH_INCLUSION_MINUTES * BASE_BLOCKS_PER_MINUTE,
	largeDepositConfirmations: L1_FINALITY_MINUTES * BASE_BLOCKS_PER_MINUTE,
	largeDepositThresholdCents: 100_000,
} as const;

const DEFAULT_MONEY_SETTINGS = {
	minimumDepositCents: 500,
	delegatedSignerMinimumHourlyCapCents: 100,
	fundsStopMarginMinutes: 5,
} as const;

export const SETTINGS_FIRST_RUN_ACTOR_ID = 'settings-first-run';

const DEFAULT_ORGANIZATION_QUOTA = {
	maxCpuPerSandbox: 4,
	maxMemoryPerSandbox: 8,
	maxDiskPerSandbox: 10,
} as const;

export const SETTINGS_DEFAULTS = {
	defaultSnapshot: null,
	defaultSandboxClass: SandboxClass.LINUX_VM,
	sandboxDefaultLimitedNetworkEgress: false,
	...DEFAULT_ORGANIZATION_QUOTA,
	machineGuestRegistryUrl: null,
	machineDesktopEnabled: false,
	machineSerialConsoleEnabled: false,
	minimumMachineReleaseVersion: null,
	publicIngressEnabled: false,
	...DEFAULT_FEE_SETTINGS,
	...DEFAULT_PRICING_SETTINGS,
	...DEFAULT_TRAFFIC_SETTINGS,
	...DEFAULT_ARCHIVE_SETTINGS,
	...DEFAULT_MARKETPLACE_SETTINGS,
	...DEFAULT_VERIFICATION_SETTINGS,
	...DEFAULT_DEPOSIT_CONFIRMATION_SETTINGS,
	...DEFAULT_VOUCHER_SETTINGS,
	...DEFAULT_MONEY_SETTINGS,
	quotaTiers: DEFAULT_QUOTA_TIERS.map((tier) => structuredClone(tier)),
	...DEFAULT_RELAY_FEE_SETTINGS,
	maintenanceMode: false,
	drainingMode: DrainingMode.ARCHIVE,
	drainingForce: false,
} as const;
