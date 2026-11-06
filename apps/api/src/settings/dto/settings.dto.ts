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
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { ESCROW_MAXIMUM_FEE_BASIS_POINTS } from '../../settlement/constants/settlement.constants';
import {
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

	@ApiProperty({ description: 'vCPUs per organization' })
	totalCpuQuota: number;

	@ApiProperty({
		description: 'GiB of memory per organization',
	})
	totalMemoryQuota: number;

	@ApiProperty({
		description: 'GiB of disk per organization',
	})
	totalDiskQuota: number;

	@ApiProperty({ description: 'vCPUs per sandbox' })
	maxCpuPerSandbox: number;

	@ApiProperty({ description: 'GiB of memory per sandbox' })
	maxMemoryPerSandbox: number;

	@ApiProperty({ description: 'GiB of disk per sandbox' })
	maxDiskPerSandbox: number;

	@ApiProperty({ description: 'Snapshots per organization' })
	snapshotQuota: number;

	@ApiProperty({ description: 'GiB per snapshot' })
	maxSnapshotSize: number;

	@ApiProperty({ description: 'Volumes per organization' })
	volumeQuota: number;

	@ApiProperty({
		...NULLABLE_STRING,
		description: 'Registry machines pull guest images from',
	})
	machineGuestRegistryUrl: string | null;

	@ApiProperty({ description: 'Let sandboxes run the computer-use desktop' })
	machineDesktopEnabled: boolean;

	@ApiProperty({ description: 'Let hosts attach to serial consoles' })
	machineSerialConsoleEnabled: boolean;

	@ApiProperty({ description: 'Allow public (unauthenticated) exposures' })
	publicIngressEnabled: boolean;

	@ApiProperty({
		description:
			'Markup added to the host price of machines below the Verified tier, in basis points of the host price',
		maximum: ESCROW_MAXIMUM_FEE_BASIS_POINTS,
	})
	standardMarkupBasisPoints: number;

	@ApiProperty({
		description:
			'Markup added to the host price of Verified and Datacenter machines, in basis points of the host price',
		maximum: ESCROW_MAXIMUM_FEE_BASIS_POINTS,
	})
	verifiedMarkupBasisPoints: number;

	@ApiProperty({
		description:
			'Monthly fee per machine an organization keeps in its private pool, micro-USD, prorated by UTC day',
	})
	privatePoolMachineMonthlyMicroUsd: number;

	@ApiProperty({
		description: 'Lowest vCPU-hour price a host may set, micro-USD',
	})
	vcpuHourPriceMinimumMicroUsd: number;

	@ApiProperty({
		description: 'Highest vCPU-hour price a host may set, micro-USD',
	})
	vcpuHourPriceMaximumMicroUsd: number;

	@ApiProperty({
		description: 'Lowest memory price a host may set, micro-USD per GiB-hour',
	})
	memoryGibHourPriceMinimumMicroUsd: number;

	@ApiProperty({
		description: 'Highest memory price a host may set, micro-USD per GiB-hour',
	})
	memoryGibHourPriceMaximumMicroUsd: number;

	@ApiProperty({
		description: 'Lowest GPU-hour price a host may set, micro-USD',
	})
	gpuHourPriceMinimumMicroUsd: number;

	@ApiProperty({
		description: 'Highest GPU-hour price a host may set, micro-USD',
	})
	gpuHourPriceMaximumMicroUsd: number;

	@ApiProperty({
		description:
			'Lowest running or stopped disk price a host may set, micro-USD per GiB-month',
	})
	diskGibMonthPriceMinimumMicroUsd: number;

	@ApiProperty({
		description:
			'Highest running or stopped disk price a host may set, micro-USD per GiB-month',
	})
	diskGibMonthPriceMaximumMicroUsd: number;

	@ApiProperty({
		description:
			'Price floor, in basis points of the market reference price median',
		maximum: BASIS_POINTS_SCALE,
	})
	priceFloorBasisPoints: number;

	@ApiProperty({
		description:
			'Verified hosts a price class needs before its market median replaces the bootstrap median',
	})
	priceFloorMinimumSamples: number;

	@ApiProperty({ description: 'Days a lease keeps its price' })
	priceLockDays: number;

	@ApiProperty({
		description: 'Days a customer has to accept a lease renewal',
	})
	leaseRenewalGraceDays: number;

	@ApiProperty({
		description: 'Days a stopped sandbox keeps its disk on the machine',
	})
	stoppedSandboxRetentionDays: number;

	@ApiProperty({
		description: 'Minutes a pinned start waits for its machine',
	})
	pinnedStartWaitMinutes: number;

	@ApiProperty({
		description: 'Highest net egress price a host may set, micro-USD per GiB',
	})
	egressPriceCeilingMicroUsdPerGiB: number;

	@ApiProperty({
		description:
			'Market egress ceiling, in basis points of the Verified hosts median egress price',
	})
	egressCeilingMedianBasisPoints: number;

	@ApiProperty({
		description:
			'Bandwidth of every sandbox of an organization over its network budget, bits per second',
	})
	networkBudgetThrottleBandwidthBps: number;

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
		description: 'Seconds between the escrow vouchers issued for each lease',
	})
	voucherIntervalSeconds: number;

	@ApiProperty({
		description:
			'Voucher intervals a lease may go without a signed voucher before its sandbox counts as unfunded',
	})
	voucherGraceIntervals: number;

	@ApiProperty({ description: 'Hours an escrow voucher stays claimable' })
	voucherLifetimeHours: number;

	@ApiProperty({
		description: 'Minutes between the claims Snapflow relays for each lease',
	})
	claimIntervalMinutes: number;

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
