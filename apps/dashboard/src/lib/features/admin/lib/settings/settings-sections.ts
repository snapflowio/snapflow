/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { quantitySetting, type SettingsSection } from './settings-fields.ts';
import {
	HTTP_URL_PATTERN,
	IP_NETWORK_PATTERN,
	UUID_PATTERN,
} from './settings-validators.ts';

const EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM = 64;

export const QUOTA_SECTION: SettingsSection = {
	title: 'Account quota defaults',
	note: 'Quotas new accounts receive. Existing accounts keep their quotas.',
	fields: [
		quantitySetting('totalCpuQuota', 'Total CPU', 'vCPUs'),
		quantitySetting('totalMemoryQuota', 'Total memory', 'GiB'),
		quantitySetting('totalDiskQuota', 'Total disk', 'GiB'),
		quantitySetting('maxCpuPerSandbox', 'CPU per sandbox', 'vCPUs'),
		quantitySetting('maxMemoryPerSandbox', 'Memory per sandbox', 'GiB'),
		quantitySetting('maxDiskPerSandbox', 'Disk per sandbox', 'GiB'),
		quantitySetting('snapshotQuota', 'Snapshots', 'count'),
		quantitySetting('maxSnapshotSize', 'Snapshot size', 'GiB'),
		quantitySetting('volumeQuota', 'Volumes', 'count'),
	],
};

export const PRICING_SECTION: SettingsSection = {
	title: 'Pricing',
	note: 'Markups apply to leases and quotes created after saving; the private pool fee applies from the next daily posting.',
	fields: [
		quantitySetting(
			'standardMarkupBasisPoints',
			'Standard markup',
			'basis points of the host price'
		),
		quantitySetting(
			'verifiedMarkupBasisPoints',
			'Verified and Datacenter markup',
			'basis points of the host price'
		),
		quantitySetting(
			'privatePoolMachineMonthlyMicroUsd',
			'Private pool fee',
			'micro-USD per machine per month'
		),
		quantitySetting(
			'egressPriceCeilingMicroUsdPerGiB',
			'Egress price ceiling',
			'micro-USD per GiB'
		),
		quantitySetting(
			'egressCeilingMedianBasisPoints',
			'Market egress ceiling',
			'basis points of the Verified median'
		),
	],
};

export const MARKETPLACE_SECTION: SettingsSection = {
	title: 'Marketplace',
	note: 'Applies to price cards, leases and placements after saving.',
	fields: [
		quantitySetting(
			'priceFloorBasisPoints',
			'Price floor',
			'basis points of the median'
		),
		quantitySetting(
			'priceFloorMinimumSamples',
			'Floor samples',
			'Verified hosts'
		),
		quantitySetting('priceLockDays', 'Price lock', 'days'),
		quantitySetting('leaseRenewalGraceDays', 'Renewal grace', 'days'),
		quantitySetting(
			'stoppedSandboxRetentionDays',
			'Stopped disk retention',
			'days'
		),
		quantitySetting('pinnedStartWaitMinutes', 'Pinned start wait', 'minutes'),
		quantitySetting(
			'networkBudgetThrottleBandwidthBps',
			'Bandwidth over the network budget',
			'bits per second'
		),
		quantitySetting(
			'exposureCeilingProbationaryCents',
			'Probationary exposure ceiling',
			'US cents'
		),
		quantitySetting(
			'exposureCeilingEstablishedCents',
			'Established exposure ceiling',
			'US cents'
		),
		quantitySetting(
			'exposureCeilingHostCents',
			'Host exposure ceiling',
			'US cents'
		),
	],
};

export const VERIFICATION_SECTION: SettingsSection = {
	title: 'Verification',
	note: 'Tiers are re-evaluated on the next verification cycle.',
	fields: [
		quantitySetting('listingMinimumDownlinkMbps', 'Minimum downlink', 'Mbps'),
		quantitySetting('listingMinimumUplinkMbps', 'Minimum uplink', 'Mbps'),
		quantitySetting(
			'listingMinimumDiskRandomReadIops',
			'Minimum random read',
			'IOPS'
		),
		quantitySetting(
			'listingMinimumDiskSequentialMibps',
			'Minimum sequential disk',
			'MiB/s'
		),
		quantitySetting(
			'verifiedMinimumListedDays',
			'Verified: days listed',
			'days'
		),
		quantitySetting(
			'verifiedMinimumUptimeBasisPoints',
			'Verified: 30-day uptime',
			'basis points'
		),
		quantitySetting(
			'verifiedMinimumSpotChecks',
			'Verified: spot checks passed',
			'count'
		),
		quantitySetting(
			'spotCheckIntervalHoursCommunity',
			'Community spot checks',
			'hours apart'
		),
		quantitySetting(
			'spotCheckIntervalHoursVerified',
			'Verified spot checks',
			'hours apart'
		),
		quantitySetting(
			'spotCheckMonthlyBudgetCents',
			'Spot-check budget',
			'US cents per month'
		),
		quantitySetting(
			'spotCheckToleranceBasisPoints',
			'Spot-check tolerance',
			'basis points'
		),
		{
			kind: 'text',
			name: 'spotCheckOrganizationId',
			label: 'Spot-check organization',
			optional: true,
			placeholder: '00000000-0000-0000-0000-000000000000',
			hint: 'Organization whose credit pays for spot-check sandboxes. Leave empty to pause spot checks.',
			pattern: UUID_PATTERN,
		},
	],
};

export const HOST_PRICE_LIMITS_SECTION: SettingsSection = {
	title: 'Host price limits',
	note: 'New price cards outside these ranges are refused. Existing cards keep their prices.',
	fields: [
		quantitySetting(
			'vcpuHourPriceMinimumMicroUsd',
			'Minimum vCPU price',
			'micro-USD per vCPU-hour'
		),
		quantitySetting(
			'vcpuHourPriceMaximumMicroUsd',
			'Maximum vCPU price',
			'micro-USD per vCPU-hour'
		),
		quantitySetting(
			'memoryGibHourPriceMinimumMicroUsd',
			'Minimum memory price',
			'micro-USD per GiB-hour'
		),
		quantitySetting(
			'memoryGibHourPriceMaximumMicroUsd',
			'Maximum memory price',
			'micro-USD per GiB-hour'
		),
		quantitySetting(
			'gpuHourPriceMinimumMicroUsd',
			'Minimum GPU price',
			'micro-USD per GPU-hour'
		),
		quantitySetting(
			'gpuHourPriceMaximumMicroUsd',
			'Maximum GPU price',
			'micro-USD per GPU-hour'
		),
		quantitySetting(
			'diskGibMonthPriceMinimumMicroUsd',
			'Minimum disk price',
			'micro-USD per GiB-month'
		),
		quantitySetting(
			'diskGibMonthPriceMaximumMicroUsd',
			'Maximum disk price',
			'micro-USD per GiB-month'
		),
	],
};

export const SETTLEMENT_SECTION: SettingsSection = {
	title: 'Settlement',
	note: 'Applies to escrow indexing, vouchers and claims after saving.',
	fields: [
		quantitySetting(
			'settlementConfirmations',
			'Escrow confirmations',
			'blocks'
		),
		quantitySetting('voucherIntervalSeconds', 'Voucher interval', 'seconds'),
		quantitySetting(
			'voucherGraceIntervals',
			'Unsigned voucher grace',
			'voucher intervals'
		),
		quantitySetting('voucherLifetimeHours', 'Voucher lifetime', 'hours'),
		quantitySetting('claimIntervalMinutes', 'Claim interval', 'minutes'),
	],
};

export const EDGE_INGRESS_SECTION: SettingsSection = {
	title: 'Edge ingress',
	note: 'Edges pick up changes with their next route snapshot.',
	fields: [
		{
			kind: 'list',
			name: 'edgeTrustedHttpProxyCidrs',
			label: 'Trusted HTTP proxy networks',
			hint: 'Proxies whose forwarded client addresses the edges trust when Cloudflare’s published networks are unavailable.',
			maximum: EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM,
			placeholder: '192.0.2.0/24\n2001:db8::/32',
			pattern: IP_NETWORK_PATTERN,
		},
	],
};

export const MACHINE_REGISTRY_SECTION: SettingsSection = {
	title: 'Machine registry',
	note: 'Machines pick up changes on their next policy refresh.',
	fields: [
		{
			kind: 'text',
			name: 'machineGuestRegistryUrl',
			label: 'Guest image registry',
			optional: true,
			placeholder: 'https://registry.example.com',
			hint: 'Registry machines pull guest images from. Leave empty for the default.',
			pattern: HTTP_URL_PATTERN,
		},
	],
};

export const MACHINE_POLICY_SECTION: SettingsSection = {
	title: 'Machine policy',
	note: 'Machines pick up changes on their next policy refresh.',
	fields: [
		{
			kind: 'switch',
			name: 'machineDesktopEnabled',
			label: 'Computer-use desktop',
			description: 'Let sandboxes run the remote desktop.',
		},
		{
			kind: 'switch',
			name: 'machineSerialConsoleEnabled',
			label: 'Serial console',
			description: 'Let hosts attach to sandbox serial consoles.',
		},
		{
			kind: 'switch',
			name: 'publicIngressEnabled',
			label: 'Public ingress',
			description: 'Allow public (unauthenticated) sandbox exposures.',
		},
	],
};
