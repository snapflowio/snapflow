/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Settings } from '../entities/settings.entity';

export type SettingsSnapshot = Readonly<Omit<Settings, 'id'>>;

type Metadata = 'resourceVersion' | 'updatedAt' | 'updatedBy';

type SettingsValues = Omit<SettingsSnapshot, Metadata>;

export type SettingsChanges = Partial<SettingsValues>;

export function toSettingsSnapshot(settings: Settings): SettingsSnapshot {
	return Object.freeze({
		defaultSnapshot: settings.defaultSnapshot,
		defaultSandboxClass: settings.defaultSandboxClass,
		sandboxDefaultLimitedNetworkEgress:
			settings.sandboxDefaultLimitedNetworkEgress,
		totalCpuQuota: settings.totalCpuQuota,
		totalMemoryQuota: settings.totalMemoryQuota,
		totalDiskQuota: settings.totalDiskQuota,
		maxCpuPerSandbox: settings.maxCpuPerSandbox,
		maxMemoryPerSandbox: settings.maxMemoryPerSandbox,
		maxDiskPerSandbox: settings.maxDiskPerSandbox,
		snapshotQuota: settings.snapshotQuota,
		maxSnapshotSize: settings.maxSnapshotSize,
		volumeQuota: settings.volumeQuota,
		machineGuestRegistryUrl: settings.machineGuestRegistryUrl,
		machineDesktopEnabled: settings.machineDesktopEnabled,
		machineSerialConsoleEnabled: settings.machineSerialConsoleEnabled,
		publicIngressEnabled: settings.publicIngressEnabled,
		platformMarkupBasisPoints: settings.platformMarkupBasisPoints,
		priceFloorBasisPoints: settings.priceFloorBasisPoints,
		priceFloorMinimumSamples: settings.priceFloorMinimumSamples,
		priceLockDays: settings.priceLockDays,
		leaseRenewalGraceDays: settings.leaseRenewalGraceDays,
		stoppedSandboxRetentionDays: settings.stoppedSandboxRetentionDays,
		pinnedStartWaitMinutes: settings.pinnedStartWaitMinutes,
		egressPriceCeilingMicroUsdPerGiB: settings.egressPriceCeilingMicroUsdPerGiB,
		egressCeilingMedianBasisPoints: settings.egressCeilingMedianBasisPoints,
		networkBudgetThrottleBandwidthBps:
			settings.networkBudgetThrottleBandwidthBps,
		exposureCeilingProbationaryCents: settings.exposureCeilingProbationaryCents,
		exposureCeilingEstablishedCents: settings.exposureCeilingEstablishedCents,
		exposureCeilingHostCents: settings.exposureCeilingHostCents,
		listingMinimumDownlinkMbps: settings.listingMinimumDownlinkMbps,
		listingMinimumUplinkMbps: settings.listingMinimumUplinkMbps,
		listingMinimumDiskRandomReadIops: settings.listingMinimumDiskRandomReadIops,
		listingMinimumDiskSequentialMibps:
			settings.listingMinimumDiskSequentialMibps,
		verifiedMinimumListedDays: settings.verifiedMinimumListedDays,
		verifiedMinimumUptimeBasisPoints: settings.verifiedMinimumUptimeBasisPoints,
		verifiedMinimumSpotChecks: settings.verifiedMinimumSpotChecks,
		spotCheckIntervalHoursCommunity: settings.spotCheckIntervalHoursCommunity,
		spotCheckIntervalHoursVerified: settings.spotCheckIntervalHoursVerified,
		spotCheckMonthlyBudgetCents: settings.spotCheckMonthlyBudgetCents,
		spotCheckToleranceBasisPoints: settings.spotCheckToleranceBasisPoints,
		spotCheckOrganizationId: settings.spotCheckOrganizationId,
		topUpMinimumCents: settings.topUpMinimumCents,
		topUpMaximumCents: settings.topUpMaximumCents,
		topUpPresetsCents: [...settings.topUpPresetsCents],
		autoTopUpMinimumCents: settings.autoTopUpMinimumCents,
		autoTopUpMinimumIntervalMinutes: settings.autoTopUpMinimumIntervalMinutes,
		topUpAttemptsPerHour: settings.topUpAttemptsPerHour,
		paymentMethodsPerDay: settings.paymentMethodsPerDay,
		organizationsPerCardFingerprint: settings.organizationsPerCardFingerprint,
		payoutMinimumCents: settings.payoutMinimumCents,
		payoutWeekday: settings.payoutWeekday,
		payoutHoldCommunityDays: settings.payoutHoldCommunityDays,
		payoutHoldVerifiedDays: settings.payoutHoldVerifiedDays,
		payoutHoldDatacenterDays: settings.payoutHoldDatacenterDays,
		newFundingHoldDays: settings.newFundingHoldDays,
		stripeTaxEnabled: settings.stripeTaxEnabled,
		payoutCountries: [...settings.payoutCountries],
		edgeTrustedHttpProxyCidrs: [...settings.edgeTrustedHttpProxyCidrs],
		maintenanceMode: settings.maintenanceMode,
		drainingMode: settings.drainingMode,
		drainingForce: settings.drainingForce,
		resourceVersion: settings.resourceVersion,
		updatedBy: settings.updatedBy,
		updatedAt: settings.updatedAt,
	});
}
