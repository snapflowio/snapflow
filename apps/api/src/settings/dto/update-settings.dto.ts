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
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsSemVer,
	IsString,
	IsUrl,
	IsUUID,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import { QUOTA_TIERS_MAXIMUM } from '../../organization/constants/organization-quota-tier.constants';
import { QuotaTierDto } from '../../organization/dto/quota-tier.dto';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { MAXIMUM_MARKUP_BASIS_POINTS } from '../../settlement/constants/settlement.constants';
import {
	AbuseEnforcementMode,
	ARCHIVE_AFTER_STOPPED_DAYS,
	DrainingMode,
	EDGE_TRUSTED_HTTP_PROXY_CIDRS_MAXIMUM,
	SANDBOX_BANDWIDTH_LIMIT_MBPS,
	SANDBOX_BURST_MIB,
	SANDBOX_HOST_LINK_SHARE_BASIS_POINTS,
	SANDBOX_MAX_CONNECTIONS,
	SANDBOX_NEW_CONNECTIONS_PER_SECOND,
	SANDBOX_PACKETS_PER_SECOND,
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

function OptionalMarkup(description: string) {
	return OptionalBoundedInteger(
		description,
		MINIMUM_QUANTITY,
		MAXIMUM_MARKUP_BASIS_POINTS
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

	@OptionalQuantity('vCPUs per sandbox')
	maxCpuPerSandbox?: number;

	@OptionalQuantity('GiB of memory per sandbox')
	maxMemoryPerSandbox?: number;

	@OptionalQuantity('GiB of disk per sandbox')
	maxDiskPerSandbox?: number;

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

	@OptionalNullable('Oldest Snapflow release machines may run')
	@IsSemVer()
	minimumMachineReleaseVersion?: string | null;

	@OptionalSwitch('Allow public (unauthenticated) exposures')
	publicIngressEnabled?: boolean;

	@OptionalMarkup(
		"Markup added on top of the host price of every machine rented from another organization, in basis points of the host price; its fee share of each payment, m / (1 + m), may not exceed the escrow's maximum fee"
	)
	markupBasisPoints?: number;

	@OptionalPositiveQuantity(
		'Days before a price increase reaches a running sandbox that does not start again'
	)
	priceLockDays?: number;

	@OptionalPositiveQuantity(
		'Minutes a sandbox start waits for its machine before it is withdrawn'
	)
	startWaitMinutes?: number;

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

	@OptionalPositiveQuantity(
		"Blocks the settlement chain must build on an escrow event before Snapflow indexes it; events also wait for the chain's safe block"
	)
	settlementConfirmations?: number;

	@OptionalPositiveQuantity(
		"Blocks the settlement chain must build on a large deposit before it counts as credit; large deposits also wait for the chain's finalized block"
	)
	largeDepositConfirmations?: number;

	@OptionalQuantity(
		'Deposits of at least this many cents wait for largeDepositConfirmations before they count as credit'
	)
	largeDepositThresholdCents?: number;

	@OptionalPositiveQuantity(
		'Seconds between the escrow vouchers issued for each payment channel'
	)
	voucherIntervalSeconds?: number;

	@OptionalPositiveQuantity(
		'Voucher intervals a payment channel may go without a signed voucher covering its charges before its sandboxes count as unfunded'
	)
	voucherGraceIntervals?: number;

	@OptionalQuantity(
		'Net earnings, in cents, after the relay fee, from which a machine is paid out; smaller amounts carry over and Snapflow claims them before any deadline'
	)
	hostPayoutMinimumCents?: number;

	@OptionalQuantity('Smallest escrow deposit a customer makes, cents')
	minimumDepositCents?: number;

	@OptionalPositiveQuantity(
		"Lowest hourly spending limit suggested for a delegated voucher signer, cents; the suggestion is the larger of this and the running sandboxes' hourly price with headroom"
	)
	delegatedSignerMinimumHourlyCapCents?: number;

	@OptionalPositiveQuantity(
		"Minutes of usage kept in reserve: an organization's compute stops when its balance would not cover one accounting window plus this margin, and an API key's sandboxes stop when its remaining budget would not cover one funding check plus this margin"
	)
	fundsStopMarginMinutes?: number;

	@ApiPropertyOptional({
		type: [QuotaTierDto],
		maxItems: QUOTA_TIERS_MAXIMUM,
		description:
			'Quota tiers numbered from 1 without gaps; existing organizations are re-evaluated on the next sweep',
	})
	@IsOptional()
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(QUOTA_TIERS_MAXIMUM)
	@ValidateNested({ each: true })
	@Type(() => QuotaTierDto)
	quotaTiers?: QuotaTierDto[];

	@OptionalQuantity(
		'What every USDC relay fee (passkey wallet transactions, host payouts, auto top-ups) adds to the gas it is estimated to cost at live prices, in basis points of that cost'
	)
	relayFeeMarginBasisPoints?: number;

	@OptionalPositiveQuantity(
		`The highest fee the relayer accepts for a passkey wallet transaction, in basis points of what its gas costs at live prices; at least ${BASIS_POINTS_SCALE} plus the margin`
	)
	walletFeeCapBasisPoints?: number;

	@OptionalQuantity(
		'Snapflow storage rate per GiB-month of compressed stored bytes, micro-USD'
	)
	storageMicroUsdPerGibMonth?: number;

	@OptionalPositiveQuantity(
		'Stored GiB an organization may keep in Snapflow storage unless an administrator set its own cap'
	)
	storageCapGibDefault?: number;

	@OptionalBoundedInteger(
		'Upload limit of every sandbox, Mbps, pushed to machines',
		SANDBOX_BANDWIDTH_LIMIT_MBPS.MINIMUM,
		SANDBOX_BANDWIDTH_LIMIT_MBPS.MAXIMUM
	)
	sandboxUploadBandwidthLimitMbps?: number;

	@OptionalBoundedInteger(
		'Download limit of every sandbox, Mbps, pushed to machines',
		SANDBOX_BANDWIDTH_LIMIT_MBPS.MINIMUM,
		SANDBOX_BANDWIDTH_LIMIT_MBPS.MAXIMUM
	)
	sandboxDownloadBandwidthLimitMbps?: number;

	@OptionalBoundedInteger(
		'Traffic a sandbox may send or receive at full speed before its limits apply, MiB',
		SANDBOX_BURST_MIB.MINIMUM,
		SANDBOX_BURST_MIB.MAXIMUM
	)
	sandboxBurstMib?: number;

	@OptionalBoundedInteger(
		'Packets per second a sandbox may send',
		SANDBOX_PACKETS_PER_SECOND.MINIMUM,
		SANDBOX_PACKETS_PER_SECOND.MAXIMUM
	)
	sandboxPacketsPerSecondLimit?: number;

	@OptionalBoundedInteger(
		'New outbound connections per second a sandbox may open',
		SANDBOX_NEW_CONNECTIONS_PER_SECOND.MINIMUM,
		SANDBOX_NEW_CONNECTIONS_PER_SECOND.MAXIMUM
	)
	sandboxNewConnectionsPerSecond?: number;

	@OptionalBoundedInteger(
		'Open connections a sandbox may hold',
		SANDBOX_MAX_CONNECTIONS.MINIMUM,
		SANDBOX_MAX_CONNECTIONS.MAXIMUM
	)
	sandboxMaxConnections?: number;

	@OptionalBoundedInteger(
		"Share of a machine's measured links all of its sandboxes may use together, in basis points",
		SANDBOX_HOST_LINK_SHARE_BASIS_POINTS.MINIMUM,
		SANDBOX_HOST_LINK_SHARE_BASIS_POINTS.MAXIMUM
	)
	sandboxHostLinkShareBasisPoints?: number;

	@ApiPropertyOptional({
		enum: AbuseEnforcementMode,
		enumName: 'AbuseEnforcementMode',
		description:
			'Observe only counts abuse signals; enforce drops over-limit traffic and throttles or suspends abusive sandboxes',
	})
	@IsOptional()
	@IsEnum(AbuseEnforcementMode)
	abuseEnforcementMode?: AbuseEnforcementMode;

	@OptionalBoundedInteger(
		'Days a sandbox stays stopped on its machine before it is archived, unless its organization set its own',
		ARCHIVE_AFTER_STOPPED_DAYS.MINIMUM,
		ARCHIVE_AFTER_STOPPED_DAYS.MAXIMUM
	)
	archiveAfterStoppedDaysDefault?: number;

	@OptionalPositiveQuantity(
		'Minutes a machine may stay offline before its stopped sandboxes are archived'
	)
	archiveAfterMachineOfflineMinutes?: number;

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
