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
		maxCpuPerSandbox: settings.maxCpuPerSandbox,
		maxMemoryPerSandbox: settings.maxMemoryPerSandbox,
		maxDiskPerSandbox: settings.maxDiskPerSandbox,
		machineGuestRegistryUrl: settings.machineGuestRegistryUrl,
		machineDesktopEnabled: settings.machineDesktopEnabled,
		machineSerialConsoleEnabled: settings.machineSerialConsoleEnabled,
		minimumMachineReleaseVersion: settings.minimumMachineReleaseVersion,
		publicIngressEnabled: settings.publicIngressEnabled,
		markupBasisPoints: settings.markupBasisPoints,
		priceLockDays: settings.priceLockDays,
		startWaitMinutes: settings.startWaitMinutes,
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
		settlementConfirmations: settings.settlementConfirmations,
		largeDepositConfirmations: settings.largeDepositConfirmations,
		largeDepositThresholdCents: settings.largeDepositThresholdCents,
		voucherIntervalSeconds: settings.voucherIntervalSeconds,
		voucherGraceIntervals: settings.voucherGraceIntervals,
		hostPayoutMinimumCents: settings.hostPayoutMinimumCents,
		minimumDepositCents: settings.minimumDepositCents,
		delegatedSignerMinimumHourlyCapCents:
			settings.delegatedSignerMinimumHourlyCapCents,
		fundsStopMarginMinutes: settings.fundsStopMarginMinutes,
		quotaTiers: structuredClone(settings.quotaTiers),
		relayFeeMarginBasisPoints: settings.relayFeeMarginBasisPoints,
		walletFeeCapBasisPoints: settings.walletFeeCapBasisPoints,
		storageMicroUsdPerGibMonth: settings.storageMicroUsdPerGibMonth,
		storageCapGibDefault: settings.storageCapGibDefault,
		sandboxUploadBandwidthLimitMbps: settings.sandboxUploadBandwidthLimitMbps,
		sandboxDownloadBandwidthLimitMbps:
			settings.sandboxDownloadBandwidthLimitMbps,
		sandboxBurstMib: settings.sandboxBurstMib,
		sandboxPacketsPerSecondLimit: settings.sandboxPacketsPerSecondLimit,
		sandboxNewConnectionsPerSecond: settings.sandboxNewConnectionsPerSecond,
		sandboxMaxConnections: settings.sandboxMaxConnections,
		sandboxHostLinkShareBasisPoints: settings.sandboxHostLinkShareBasisPoints,
		abuseEnforcementMode: settings.abuseEnforcementMode,
		archiveAfterStoppedDaysDefault: settings.archiveAfterStoppedDaysDefault,
		archiveAfterMachineOfflineMinutes:
			settings.archiveAfterMachineOfflineMinutes,
		edgeTrustedHttpProxyCidrs: [...settings.edgeTrustedHttpProxyCidrs],
		maintenanceMode: settings.maintenanceMode,
		drainingMode: settings.drainingMode,
		drainingForce: settings.drainingForce,
		resourceVersion: settings.resourceVersion,
		updatedBy: settings.updatedBy,
		updatedAt: settings.updatedAt,
	});
}
