/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { AbuseEnforcementMode } from '@snapflow/api-client';
import { quantitySetting, type SettingsSection } from './setting-fields.ts';
import { SETTING_UNITS } from './setting-units.ts';
import {
	HTTP_URL_PATTERN,
	IP_NETWORK_PATTERN,
	RELEASE_VERSION_PATTERN,
	UUID_PATTERN,
} from './settings-validators.ts';

const EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM = 64;

export const QUOTA_SECTION: SettingsSection = {
	title: 'Per-sandbox defaults',
	note: 'Per-sandbox limits organizations start with; quota tiers and custom quotas raise them.',
	fields: [
		quantitySetting('maxCpuPerSandbox', 'CPU per sandbox', SETTING_UNITS.vcpus),
		quantitySetting(
			'maxMemoryPerSandbox',
			'Memory per sandbox',
			SETTING_UNITS.gib
		),
		quantitySetting('maxDiskPerSandbox', 'Disk per sandbox', SETTING_UNITS.gib),
	],
};

export const FUNDING_SECTION: SettingsSection = {
	title: 'Funding',
	note: 'Applies to deposits and start checks after saving.',
	fields: [
		quantitySetting(
			'minimumDepositCents',
			'Minimum deposit',
			SETTING_UNITS.usdcCents
		),
		quantitySetting(
			'fundsStopMarginMinutes',
			'Stop margin beyond one accounting window',
			SETTING_UNITS.minutes
		),
		quantitySetting(
			'largeDepositThresholdCents',
			'Large deposit threshold',
			SETTING_UNITS.usdcCents
		),
		quantitySetting(
			'largeDepositConfirmations',
			'Large deposit confirmations',
			SETTING_UNITS.blocks
		),
	],
};

export const RELAY_FEE_SECTION: SettingsSection = {
	title: 'Relay fees',
	note: 'The margin applies to every relay fee quoted after saving: wallet transactions, host payouts and auto top-ups. The cap applies to wallet transactions.',
	fields: [
		quantitySetting(
			'relayFeeMarginBasisPoints',
			'Fee margin',
			SETTING_UNITS.basisPointsOfGas
		),
		quantitySetting(
			'walletFeeCapBasisPoints',
			'Fee cap',
			SETTING_UNITS.basisPointsOfGas
		),
	],
};

export const PRICING_SECTION: SettingsSection = {
	title: 'Pricing',
	note: 'The markup applies to sandbox prices and quotes set after saving; the storage rate applies from the next hourly sample.',
	fields: [
		quantitySetting(
			'markupBasisPoints',
			'Markup',
			SETTING_UNITS.basisPointsOfHostPrice
		),
		quantitySetting(
			'storageMicroUsdPerGibMonth',
			'Snapflow storage rate',
			SETTING_UNITS.microUsdcPerGibMonth
		),
		quantitySetting('storageCapGibDefault', 'Storage cap', SETTING_UNITS.gib),
	],
};

const ABUSE_ENFORCEMENT_LABEL = {
	[AbuseEnforcementMode.Observe]: 'Observe',
	[AbuseEnforcementMode.Enforce]: 'Enforce',
} as const satisfies Record<AbuseEnforcementMode, string>;

export const TRAFFIC_SECTION: SettingsSection = {
	title: 'Sandbox traffic and abuse',
	note: 'Machines apply changes on their next settings refresh. Observe counts over-limit traffic and abuse signals; enforce drops the traffic and throttles or suspends abusive sandboxes.',
	fields: [
		quantitySetting(
			'sandboxUploadBandwidthLimitMbps',
			'Upload limit per sandbox',
			SETTING_UNITS.mbps
		),
		quantitySetting(
			'sandboxDownloadBandwidthLimitMbps',
			'Download limit per sandbox',
			SETTING_UNITS.mbps
		),
		quantitySetting(
			'sandboxBurstMib',
			'Burst allowance',
			SETTING_UNITS.mib,
			'Traffic a sandbox may move at full speed before its limits apply'
		),
		quantitySetting(
			'sandboxPacketsPerSecondLimit',
			'Packets per sandbox',
			SETTING_UNITS.packetsPerSecond
		),
		quantitySetting(
			'sandboxNewConnectionsPerSecond',
			'New connections per sandbox',
			SETTING_UNITS.connectionsPerSecond
		),
		quantitySetting(
			'sandboxMaxConnections',
			'Open connections per sandbox',
			SETTING_UNITS.connections
		),
		quantitySetting(
			'sandboxHostLinkShareBasisPoints',
			'Machine link share',
			SETTING_UNITS.basisPointsOfMeasuredLinks,
			'Share of a machine’s measured links all of its sandboxes may use together'
		),
		{
			kind: 'choice',
			name: 'abuseEnforcementMode',
			label: 'Abuse enforcement',
			options: Object.values(AbuseEnforcementMode).map((mode) => ({
				label: ABUSE_ENFORCEMENT_LABEL[mode],
				value: mode,
			})),
		},
	],
};

export const MARKETPLACE_SECTION: SettingsSection = {
	title: 'Marketplace',
	note: 'Applies to machine prices, sandbox prices and placements after saving.',
	fields: [
		quantitySetting(
			'priceLockDays',
			'Price increase notice',
			SETTING_UNITS.days
		),
		quantitySetting(
			'archiveAfterStoppedDaysDefault',
			'Archive stopped sandboxes after',
			SETTING_UNITS.days
		),
		quantitySetting(
			'archiveAfterMachineOfflineMinutes',
			'Archive when the machine is offline for',
			SETTING_UNITS.minutes
		),
		quantitySetting(
			'startWaitMinutes',
			'Start wait',
			SETTING_UNITS.minutes,
			'How long a sandbox start waits for its machine before it is withdrawn'
		),
		quantitySetting(
			'exposureCeilingProbationaryCents',
			'Probationary exposure ceiling',
			SETTING_UNITS.usdcCents
		),
		quantitySetting(
			'exposureCeilingEstablishedCents',
			'Established exposure ceiling',
			SETTING_UNITS.usdcCents
		),
		quantitySetting(
			'exposureCeilingHostCents',
			'Host exposure ceiling',
			SETTING_UNITS.usdcCents
		),
	],
};

export const VERIFICATION_SECTION: SettingsSection = {
	title: 'Verification',
	note: 'Tiers are re-evaluated on the next verification cycle.',
	fields: [
		quantitySetting(
			'listingMinimumDownlinkMbps',
			'Minimum downlink',
			SETTING_UNITS.mbps
		),
		quantitySetting(
			'listingMinimumUplinkMbps',
			'Minimum uplink',
			SETTING_UNITS.mbps
		),
		quantitySetting(
			'listingMinimumDiskRandomReadIops',
			'Minimum random read',
			SETTING_UNITS.iops
		),
		quantitySetting(
			'listingMinimumDiskSequentialMibps',
			'Minimum sequential disk',
			SETTING_UNITS.mibPerSecond
		),
		quantitySetting(
			'verifiedMinimumListedDays',
			'Verified: days listed',
			SETTING_UNITS.days
		),
		quantitySetting(
			'verifiedMinimumUptimeBasisPoints',
			'Verified: 30-day uptime',
			SETTING_UNITS.basisPoints
		),
		quantitySetting(
			'verifiedMinimumSpotChecks',
			'Verified: spot checks passed',
			SETTING_UNITS.count
		),
		quantitySetting(
			'spotCheckIntervalHoursCommunity',
			'Community spot checks',
			SETTING_UNITS.hoursApart
		),
		quantitySetting(
			'spotCheckIntervalHoursVerified',
			'Verified spot checks',
			SETTING_UNITS.hoursApart
		),
		quantitySetting(
			'spotCheckMonthlyBudgetCents',
			'Spot-check budget',
			SETTING_UNITS.usdcCentsPerMonth
		),
		quantitySetting(
			'spotCheckToleranceBasisPoints',
			'Spot-check tolerance',
			SETTING_UNITS.basisPoints
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

export const SETTLEMENT_SECTION: SettingsSection = {
	title: 'Settlement',
	note: 'Applies to escrow indexing, vouchers and host settlements after saving.',
	fields: [
		quantitySetting(
			'settlementConfirmations',
			'Escrow confirmations',
			SETTING_UNITS.blocks
		),
		quantitySetting(
			'voucherIntervalSeconds',
			'Voucher interval',
			SETTING_UNITS.seconds
		),
		quantitySetting(
			'voucherGraceIntervals',
			'Unsigned voucher grace',
			SETTING_UNITS.voucherIntervals
		),
		quantitySetting(
			'hostPayoutMinimumCents',
			'Host payout minimum',
			SETTING_UNITS.usdcCents
		),
		quantitySetting(
			'delegatedSignerMinimumHourlyCapCents',
			'Minimum signer hourly cap',
			SETTING_UNITS.usdcCentsPerHour
		),
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

export const MACHINE_POLICY_SECTION: SettingsSection = {
	title: 'Machine policy',
	note: 'Machines pick up changes on their next policy refresh.',
	fields: [
		{
			kind: 'switch',
			name: 'machineDesktopEnabled',
			label: 'Computer-use desktop',
			info: 'Let sandboxes run the remote desktop.',
		},
		{
			kind: 'switch',
			name: 'machineSerialConsoleEnabled',
			label: 'Serial console',
			info: 'Let hosts attach to sandbox serial consoles.',
		},
		{
			kind: 'switch',
			name: 'publicIngressEnabled',
			label: 'Public ingress',
			info: 'Allow public (unauthenticated) sandbox exposures.',
		},
		{
			kind: 'text',
			name: 'minimumMachineReleaseVersion',
			label: 'Minimum Snapflow release',
			optional: true,
			placeholder: '1.4.0',
			hint: 'Machines on an older release stop taking sandboxes and their hosts are told to update. Leave empty to allow any release.',
			pattern: RELEASE_VERSION_PATTERN,
		},
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
