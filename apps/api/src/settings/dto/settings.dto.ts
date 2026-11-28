/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import { QuotaTierDto } from '../../organization/dto/quota-tier.dto';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { MAXIMUM_MARKUP_BASIS_POINTS } from '../../settlement/constants/settlement.constants';
import {
	AbuseEnforcementMode,
	DrainingMode,
	EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM,
} from '../constants/settings.constants';
import type { SettingsSnapshot } from '../types/settings.types';

const NULLABLE_STRING = { type: String, nullable: true } as const;

@ApiSchema({ name: 'Settings' })
export class SettingsDto {
	@ApiProperty({
		...NULLABLE_STRING,
		description: 'Image every installation imports as its default snapshot',
	})
	defaultSnapshot: string | null;

	@ApiProperty({ enum: SandboxClass, enumName: 'SandboxClass' })
	defaultSandboxClass: SandboxClass;

	@ApiProperty({ description: 'Limit network egress of new organizations' })
	sandboxDefaultLimitedNetworkEgress: boolean;

	@ApiProperty({ description: 'vCPUs per sandbox' })
	maxCpuPerSandbox: number;

	@ApiProperty({ description: 'GiB of memory per sandbox' })
	maxMemoryPerSandbox: number;

	@ApiProperty({ description: 'GiB of disk per sandbox' })
	maxDiskPerSandbox: number;

	@ApiProperty({
		...NULLABLE_STRING,
		description: 'Registry machines pull guest images from',
	})
	machineGuestRegistryUrl: string | null;

	@ApiProperty({ description: 'Let sandboxes run the computer-use desktop' })
	machineDesktopEnabled: boolean;

	@ApiProperty({ description: 'Let hosts attach to serial consoles' })
	machineSerialConsoleEnabled: boolean;

	@ApiProperty({
		...NULLABLE_STRING,
		description:
			'Oldest Snapflow release machines may run; older machines stop taking sandboxes until they update',
	})
	minimumMachineReleaseVersion: string | null;

	@ApiProperty({ description: 'Allow public (unauthenticated) exposures' })
	publicIngressEnabled: boolean;

	@ApiProperty({
		description:
			"Markup added on top of the host price of every machine rented from another organization, in basis points of the host price; its fee share of each payment, m / (1 + m), may not exceed the escrow's maximum fee",
		maximum: MAXIMUM_MARKUP_BASIS_POINTS,
	})
	markupBasisPoints: number;

	@ApiProperty({
		description:
			'Days before a price increase reaches a running sandbox that does not start again',
	})
	priceLockDays: number;

	@ApiProperty({
		description:
			'Minutes a sandbox start waits for its machine before it is withdrawn',
	})
	startWaitMinutes: number;

	@ApiProperty({
		description: 'Exposure ceiling of a probationary machine, cents',
	})
	exposureCeilingProbationaryCents: number;

	@ApiProperty({
		description: 'Exposure ceiling of an established machine, cents',
	})
	exposureCeilingEstablishedCents: number;

	@ApiProperty({ description: 'Exposure ceiling of a host, cents' })
	exposureCeilingHostCents: number;

	@ApiProperty({ description: 'Minimum downlink to list a machine, Mbps' })
	listingMinimumDownlinkMbps: number;

	@ApiProperty({ description: 'Minimum uplink to list a machine, Mbps' })
	listingMinimumUplinkMbps: number;

	@ApiProperty({
		description: 'Minimum 4 KiB random read IOPS to list a machine',
	})
	listingMinimumDiskRandomReadIops: number;

	@ApiProperty({
		description: 'Minimum sequential disk throughput to list a machine, MiB/s',
	})
	listingMinimumDiskSequentialMibps: number;

	@ApiProperty({ description: 'Days listed before a machine can be Verified' })
	verifiedMinimumListedDays: number;

	@ApiProperty({
		description: '30-day uptime a Verified machine needs, in basis points',
		maximum: BASIS_POINTS_SCALE,
	})
	verifiedMinimumUptimeBasisPoints: number;

	@ApiProperty({
		description: 'Passed spot checks in 30 days a Verified machine needs',
	})
	verifiedMinimumSpotChecks: number;

	@ApiProperty({ description: 'Mean hours between Community spot checks' })
	spotCheckIntervalHoursCommunity: number;

	@ApiProperty({ description: 'Mean hours between Verified spot checks' })
	spotCheckIntervalHoursVerified: number;

	@ApiProperty({ description: 'Monthly spot-check spend limit, cents' })
	spotCheckMonthlyBudgetCents: number;

	@ApiProperty({
		description:
			'Allowed spot-check deviation from the benchmark, in basis points',
		maximum: BASIS_POINTS_SCALE,
	})
	spotCheckToleranceBasisPoints: number;

	@ApiProperty({
		...NULLABLE_STRING,
		format: 'uuid',
		description: 'Organization that runs and pays for spot checks',
	})
	spotCheckOrganizationId: string | null;

	@ApiProperty({
		description:
			'Blocks the settlement chain must build on an escrow event before Snapflow indexes it',
	})
	settlementConfirmations: number;

	@ApiProperty({
		description:
			'Blocks the settlement chain must build on a large deposit before it counts as credit; deep enough for L1 finality',
	})
	largeDepositConfirmations: number;

	@ApiProperty({
		description:
			'Deposits of at least this many cents wait for largeDepositConfirmations before they count as credit',
	})
	largeDepositThresholdCents: number;

	@ApiProperty({
		description:
			'Seconds between the escrow vouchers issued for each payment channel',
	})
	voucherIntervalSeconds: number;

	@ApiProperty({
		description:
			'Voucher intervals a payment channel may go without a signed voucher covering its charges before its sandboxes count as unfunded',
	})
	voucherGraceIntervals: number;

	@ApiProperty({
		description:
			'Net earnings, in cents, after the relay fee, from which a machine is paid out; smaller amounts carry over and Snapflow claims them before any deadline',
	})
	hostPayoutMinimumCents: number;

	@ApiProperty({
		description: 'Smallest escrow deposit a customer makes, cents',
	})
	minimumDepositCents: number;

	@ApiProperty({
		description:
			"Lowest hourly spending limit suggested for a delegated voucher signer, cents; the suggestion is the larger of this and the running sandboxes' hourly price with headroom",
	})
	delegatedSignerMinimumHourlyCapCents: number;

	@ApiProperty({
		description:
			"Minutes of usage kept in reserve: an organization's compute stops when its balance would not cover one accounting window plus this margin, and an API key's sandboxes stop when its remaining budget would not cover one funding check plus this margin",
	})
	fundsStopMarginMinutes: number;

	@ApiProperty({
		type: [QuotaTierDto],
		description:
			'Quota tiers organizations earn from a verified email and confirmed USDC deposits; the highest tier needs deposits in the trailing window',
	})
	quotaTiers: QuotaTierDto[];

	@ApiProperty({
		description:
			'What every USDC relay fee (passkey wallet transactions, host payouts, auto top-ups) adds to the gas it is estimated to cost at live prices, in basis points of that cost',
	})
	relayFeeMarginBasisPoints: number;

	@ApiProperty({
		description:
			'The highest fee the relayer accepts for a passkey wallet transaction, in basis points of what its gas costs at live prices; a lower fee than that cost is always refused',
	})
	walletFeeCapBasisPoints: number;

	@ApiProperty({
		description:
			'Snapflow storage rate per GiB-month of compressed stored bytes, micro-USD',
	})
	storageMicroUsdPerGibMonth: number;

	@ApiProperty({
		description:
			'Stored GiB an organization may keep in Snapflow storage unless an administrator set its own cap',
	})
	storageCapGibDefault: number;

	@ApiProperty({
		description: 'Upload limit of every sandbox, Mbps, pushed to machines',
	})
	sandboxUploadBandwidthLimitMbps: number;

	@ApiProperty({
		description: 'Download limit of every sandbox, Mbps, pushed to machines',
	})
	sandboxDownloadBandwidthLimitMbps: number;

	@ApiProperty({
		description:
			'Traffic a sandbox may send or receive at full speed before its limits apply, MiB',
	})
	sandboxBurstMib: number;

	@ApiProperty({ description: 'Packets per second a sandbox may send' })
	sandboxPacketsPerSecondLimit: number;

	@ApiProperty({
		description: 'New outbound connections per second a sandbox may open',
	})
	sandboxNewConnectionsPerSecond: number;

	@ApiProperty({ description: 'Open connections a sandbox may hold' })
	sandboxMaxConnections: number;

	@ApiProperty({
		description:
			"Share of a machine's measured links all of its sandboxes may use together, in basis points",
	})
	sandboxHostLinkShareBasisPoints: number;

	@ApiProperty({
		enum: AbuseEnforcementMode,
		enumName: 'AbuseEnforcementMode',
		description:
			'Observe only counts abuse signals; enforce drops over-limit traffic and throttles or suspends abusive sandboxes',
	})
	abuseEnforcementMode: AbuseEnforcementMode;

	@ApiProperty({
		description:
			'Days a sandbox stays stopped on its machine before it is archived, unless its organization set its own',
	})
	archiveAfterStoppedDaysDefault: number;

	@ApiProperty({
		description:
			'Minutes a machine may stay offline before its stopped sandboxes are archived',
	})
	archiveAfterMachineOfflineMinutes: number;

	@ApiProperty({
		type: [String],
		maxItems: EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM,
		description:
			"Proxy networks (address/prefix) in front of the edges whose forwarded client addresses the edges trust while Cloudflare's published networks are unavailable",
	})
	edgeTrustedHttpProxyCidrs: string[];

	@ApiProperty({
		description: 'API requests answer 503 and scheduled jobs stop',
	})
	maintenanceMode: boolean;

	@ApiProperty({ enum: DrainingMode, enumName: 'DrainingMode' })
	drainingMode: DrainingMode;

	@ApiProperty({
		description: 'Drain machines even when sandboxes cannot move',
	})
	drainingForce: boolean;

	@ApiProperty({ description: 'Send as If-Match when updating the settings' })
	resourceVersion: number;

	@ApiProperty({ ...NULLABLE_STRING, format: 'uuid' })
	updatedBy: string | null;

	@ApiProperty({ format: 'date-time' })
	updatedAt: string;

	static from(settings: SettingsSnapshot): SettingsDto {
		return { ...settings, updatedAt: settings.updatedAt.toISOString() };
	}
}
