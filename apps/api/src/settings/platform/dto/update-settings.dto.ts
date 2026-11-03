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
	IsISO31661Alpha2,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUrl,
	IsUUID,
	Max,
	Min,
} from 'class-validator';
import { BASIS_POINTS_SCALE } from '../../../common/constants/money.constants';
import {
	MAXIMUM_EGRESS_BANDWIDTH_BPS,
	MINIMUM_EGRESS_BANDWIDTH_BPS,
} from '../../../sandbox/instance/constants/network.constants';
import { SandboxClass } from '../../../sandbox/instance/enums/sandbox-class.enum';
import {
	DrainingMode,
	EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM,
	ISO_WEEKDAY,
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

	@OptionalBasisPoints(
		'Markup added to host prices, in basis points of the host price'
	)
	platformMarkupBasisPoints?: number;

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

	@OptionalPositiveQuantity('Smallest top-up, cents')
	topUpMinimumCents?: number;

	@OptionalPositiveQuantity('Largest top-up, cents')
	topUpMaximumCents?: number;

	@ApiPropertyOptional({
		type: [Number],
		description: 'Suggested top-ups, cents',
	})
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@Min(SETTINGS_POSITIVE_MINIMUM, { each: true })
	topUpPresetsCents?: number[];

	@OptionalQuantity('Smallest automatic top-up, cents')
	autoTopUpMinimumCents?: number;

	@OptionalQuantity('Minutes between automatic top-up attempts')
	autoTopUpMinimumIntervalMinutes?: number;

	@OptionalQuantity('Top-up attempts per organization per hour')
	topUpAttemptsPerHour?: number;

	@OptionalQuantity('Payment methods per organization per day')
	paymentMethodsPerDay?: number;

	@OptionalQuantity('Organizations that may share one card')
	organizationsPerCardFingerprint?: number;

	@OptionalQuantity('Smallest payout, cents')
	payoutMinimumCents?: number;

	@OptionalBoundedInteger(
		'ISO weekday payouts run on (1 is Monday)',
		ISO_WEEKDAY.MONDAY,
		ISO_WEEKDAY.SUNDAY
	)
	payoutWeekday?: number;

	@OptionalQuantity('Earnings hold for Community machines, days')
	payoutHoldCommunityDays?: number;

	@OptionalQuantity('Earnings hold for Verified machines, days')
	payoutHoldVerifiedDays?: number;

	@OptionalQuantity('Earnings hold for Datacenter machines, days')
	payoutHoldDatacenterDays?: number;

	@OptionalQuantity('Days credit from a new card cannot fund payouts')
	newFundingHoldDays?: number;

	@OptionalSwitch('Calculate sales tax on top-ups with Stripe Tax')
	stripeTaxEnabled?: boolean;

	@ApiPropertyOptional({
		type: [String],
		description: 'ISO 3166-1 alpha-2 countries hosts may be paid in',
	})
	@IsOptional()
	@IsArray()
	@IsISO31661Alpha2({ each: true })
	payoutCountries?: string[];

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
