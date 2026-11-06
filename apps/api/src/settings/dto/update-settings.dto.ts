/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUrl,
	IsUUID,
	Max,
	Min,
} from 'class-validator';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import {
	MAXIMUM_EGRESS_BANDWIDTH_BPS,
	MINIMUM_EGRESS_BANDWIDTH_BPS,
} from '../../sandbox/constants/network.constants';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { ESCROW_MAXIMUM_FEE_BASIS_POINTS } from '../../settlement/constants/settlement.constants';
import {
	DrainingMode,
	EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM,
	SETTINGS_POSITIVE_MINIMUM,
} from '../constants/settings.constants';

const MINIMUM_QUANTITY = 0;

function OptionalQuantity(description: string) {
	return applyDecorators(
		ApiPropertyOptional({ description, minimum: MINIMUM_QUANTITY }),
		IsOptional(),
		IsInt(),
		Min(MINIMUM_QUANTITY)
	);
}

function OptionalPositiveQuantity(description: string) {
	return applyDecorators(
		ApiPropertyOptional({ description, minimum: SETTINGS_POSITIVE_MINIMUM }),
		IsOptional(),
		IsInt(),
		Min(SETTINGS_POSITIVE_MINIMUM)
	);
}

function OptionalBoundedInteger(
	description: string,
	minimum: number,
	maximum: number
) {
	return applyDecorators(
		ApiPropertyOptional({ description, minimum, maximum }),
		IsOptional(),
		IsInt(),
		Min(minimum),
		Max(maximum)
	);
}

function OptionalBasisPoints(description: string) {
	return OptionalBoundedInteger(
		description,
		MINIMUM_QUANTITY,
		BASIS_POINTS_SCALE
	);
}

// The escrow refuses any fee above its fixed maximum, so no markup may exceed
// it; the live fee cap, which may be lower, is checked when a lease opens.
function OptionalMarkup(description: string) {
	return OptionalBoundedInteger(
		description,
		MINIMUM_QUANTITY,
		ESCROW_MAXIMUM_FEE_BASIS_POINTS
	);
}

function OptionalSwitch(description: string) {
	return applyDecorators(
		ApiPropertyOptional({ description }),
		IsOptional(),
		IsBoolean()
	);
}

function OptionalNullable(description: string) {
	return applyDecorators(
		ApiPropertyOptional({ description, type: String, nullable: true }),
		IsOptional()
	);
}

@ApiSchema({ name: 'UpdateSettings' })
export class UpdateSettingsDto {
	@OptionalNullable('Image imported as the default snapshot')
	@IsString()
	@IsNotEmpty()
	defaultSnapshot?: string | null;

	@ApiPropertyOptional({ enum: SandboxClass, enumName: 'SandboxClass' })
	@IsOptional()
	@IsEnum(SandboxClass)
	defaultSandboxClass?: SandboxClass;

	@OptionalSwitch('Limit network egress of new organizations')
	sandboxDefaultLimitedNetworkEgress?: boolean;

	@OptionalQuantity('vCPUs per organization')
	totalCpuQuota?: number;

	@OptionalQuantity('GiB of memory per organization')
	totalMemoryQuota?: number;

	@OptionalQuantity('GiB of disk per organization')
	totalDiskQuota?: number;

	@OptionalQuantity('vCPUs per sandbox')
	maxCpuPerSandbox?: number;

	@OptionalQuantity('GiB of memory per sandbox')
	maxMemoryPerSandbox?: number;

	@OptionalQuantity('GiB of disk per sandbox')
	maxDiskPerSandbox?: number;

	@OptionalQuantity('Snapshots per organization')
	snapshotQuota?: number;

	@OptionalQuantity('GiB per snapshot')
	maxSnapshotSize?: number;

	@OptionalQuantity('Volumes per organization')
	volumeQuota?: number;

	@OptionalNullable('Registry machines pull guest images from')
	@IsUrl({
		protocols: ['http', 'https'],
		require_protocol: true,
		require_tld: false,
	})
	machineGuestRegistryUrl?: string | null;

	@OptionalSwitch('Let sandboxes run the computer-use desktop')
	machineDesktopEnabled?: boolean;

	@OptionalSwitch('Let hosts attach to serial consoles')
	machineSerialConsoleEnabled?: boolean;

	@OptionalSwitch('Allow public (unauthenticated) exposures')
	publicIngressEnabled?: boolean;

	@OptionalMarkup(
		'Markup added to the host price of machines below the Verified tier, in basis points of the host price'
	)
	standardMarkupBasisPoints?: number;

	@OptionalMarkup(
		'Markup added to the host price of Verified and Datacenter machines, in basis points of the host price'
	)
	verifiedMarkupBasisPoints?: number;

	@OptionalQuantity(
		'Monthly fee per machine an organization keeps in its private pool, micro-USD, prorated by UTC day'
	)
	privatePoolMachineMonthlyMicroUsd?: number;

	@OptionalQuantity('Lowest vCPU-hour price a host may set, micro-USD')
	vcpuHourPriceMinimumMicroUsd?: number;

	@OptionalQuantity('Highest vCPU-hour price a host may set, micro-USD')
	vcpuHourPriceMaximumMicroUsd?: number;

	@OptionalQuantity(
		'Lowest memory price a host may set, micro-USD per GiB-hour'
	)
	memoryGibHourPriceMinimumMicroUsd?: number;

	@OptionalQuantity(
		'Highest memory price a host may set, micro-USD per GiB-hour'
	)
	memoryGibHourPriceMaximumMicroUsd?: number;

	@OptionalQuantity('Lowest GPU-hour price a host may set, micro-USD')
	gpuHourPriceMinimumMicroUsd?: number;

	@OptionalQuantity('Highest GPU-hour price a host may set, micro-USD')
	gpuHourPriceMaximumMicroUsd?: number;

	@OptionalQuantity(
		'Lowest running or stopped disk price a host may set, micro-USD per GiB-month'
	)
	diskGibMonthPriceMinimumMicroUsd?: number;

	@OptionalQuantity(
		'Highest running or stopped disk price a host may set, micro-USD per GiB-month'
	)
	diskGibMonthPriceMaximumMicroUsd?: number;

	@OptionalBasisPoints(
		'Price floor, in basis points of the market reference price median'
	)
	priceFloorBasisPoints?: number;

	@OptionalPositiveQuantity(
		'Verified hosts a price class needs before its market median replaces the bootstrap median'
	)
	priceFloorMinimumSamples?: number;

	@OptionalPositiveQuantity('Days a lease keeps its price')
	priceLockDays?: number;

	@OptionalPositiveQuantity('Days a customer has to accept a lease renewal')
	leaseRenewalGraceDays?: number;

	@OptionalPositiveQuantity(
		'Days a stopped sandbox keeps its disk on the machine'
	)
	stoppedSandboxRetentionDays?: number;

	@OptionalPositiveQuantity('Minutes a pinned start waits for its machine')
	pinnedStartWaitMinutes?: number;

	@OptionalQuantity(
		'Highest net egress price a host may set, micro-USD per GiB'
	)
	egressPriceCeilingMicroUsdPerGiB?: number;

	@OptionalPositiveQuantity(
		'Market egress ceiling, in basis points of the Verified hosts median egress price'
	)
	egressCeilingMedianBasisPoints?: number;

	@OptionalBoundedInteger(
		'Bandwidth of every sandbox of an organization over its network budget, bits per second',
		MINIMUM_EGRESS_BANDWIDTH_BPS,
		MAXIMUM_EGRESS_BANDWIDTH_BPS
	)
	networkBudgetThrottleBandwidthBps?: number;

	@OptionalPositiveQuantity('Exposure ceiling of a probationary machine, cents')
	exposureCeilingProbationaryCents?: number;

	@OptionalPositiveQuantity('Exposure ceiling of an established machine, cents')
	exposureCeilingEstablishedCents?: number;

	@OptionalPositiveQuantity('Exposure ceiling of a host, cents')
	exposureCeilingHostCents?: number;

	@OptionalQuantity('Minimum downlink to list a machine, Mbps')
	listingMinimumDownlinkMbps?: number;

	@OptionalQuantity('Minimum uplink to list a machine, Mbps')
	listingMinimumUplinkMbps?: number;

	@OptionalQuantity('Minimum 4 KiB random read IOPS to list a machine')
	listingMinimumDiskRandomReadIops?: number;

	@OptionalQuantity(
		'Minimum sequential disk throughput to list a machine, MiB/s'
	)
	listingMinimumDiskSequentialMibps?: number;

	@OptionalQuantity('Days listed before a machine can be Verified')
	verifiedMinimumListedDays?: number;

	@OptionalBasisPoints(
		'30-day uptime a Verified machine needs, in basis points'
	)
	verifiedMinimumUptimeBasisPoints?: number;

	@OptionalQuantity('Passed spot checks in 30 days a Verified machine needs')
	verifiedMinimumSpotChecks?: number;

	@OptionalQuantity('Mean hours between Community spot checks')
	spotCheckIntervalHoursCommunity?: number;

	@OptionalQuantity('Mean hours between Verified spot checks')
	spotCheckIntervalHoursVerified?: number;

	@OptionalQuantity('Monthly spot-check spend limit, cents')
	spotCheckMonthlyBudgetCents?: number;

	@OptionalBasisPoints(
		'Allowed spot-check deviation from the benchmark, in basis points'
	)
	spotCheckToleranceBasisPoints?: number;

	@OptionalNullable('Organization that runs and pays for spot checks')
	@IsUUID()
	spotCheckOrganizationId?: string | null;

	@OptionalQuantity(
		'Blocks the settlement chain must build on an escrow event before Snapflow indexes it'
	)
	settlementConfirmations?: number;

	@OptionalPositiveQuantity(
		'Seconds between the escrow vouchers issued for each lease'
	)
	voucherIntervalSeconds?: number;

	@OptionalPositiveQuantity(
		'Voucher intervals a lease may go without a signed voucher before its sandbox counts as unfunded'
	)
	voucherGraceIntervals?: number;

	@OptionalPositiveQuantity('Hours an escrow voucher stays claimable')
	voucherLifetimeHours?: number;

	@OptionalPositiveQuantity(
		'Minutes between the claims Snapflow relays for each lease'
	)
	claimIntervalMinutes?: number;

	@ApiPropertyOptional({
		type: [String],
		maxItems: EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM,
		description:
			"Proxy networks (address/prefix) in front of the edges whose forwarded client addresses the edges trust while Cloudflare's published networks are unavailable; an empty list trusts none",
	})
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM)
	@IsString({ each: true })
	edgeTrustedHttpProxyCidrs?: string[];
}

@ApiSchema({ name: 'SetMaintenanceMode' })
export class SetMaintenanceModeDto {
	@ApiProperty({ description: 'Answer non-admin requests with 503' })
	@IsBoolean()
	enabled: boolean;
}

@ApiSchema({ name: 'SetDrainingPolicy' })
export class SetDrainingPolicyDto {
	@ApiProperty({ enum: DrainingMode, enumName: 'DrainingMode' })
	@IsEnum(DrainingMode)
	mode: DrainingMode;

	@ApiProperty({ description: 'Stop running sandboxes so drains converge' })
	@IsBoolean()
	force: boolean;
}
