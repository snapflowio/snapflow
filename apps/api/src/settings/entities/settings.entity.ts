/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ArrayType } from '@mikro-orm/core';
import {
	Check,
	Entity,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import { Organization } from '../../organization/entities/organization.entity';
import {
	MAXIMUM_EGRESS_BANDWIDTH_BPS,
	MINIMUM_EGRESS_BANDWIDTH_BPS,
} from '../../sandbox/constants/network.constants';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import {
	DrainingMode,
	ISO_WEEKDAY,
	SETTINGS_ID,
	SETTINGS_POSITIVE_MINIMUM,
	SETTINGS_RESOURCE_VERSION_INITIAL,
} from '../constants/settings.constants';

const sqlList = (values: readonly string[]) =>
	values.map((value) => `'${value}'`).join(', ');

const NON_NEGATIVE_COLUMNS = [
	'totalCpuQuota',
	'totalMemoryQuota',
	'totalDiskQuota',
	'maxCpuPerSandbox',
	'maxMemoryPerSandbox',
	'maxDiskPerSandbox',
	'snapshotQuota',
	'maxSnapshotSize',
	'volumeQuota',
	'egressPriceCeilingMicroUsdPerGiB',
	'platformMarkupBasisPoints',
	'priceFloorBasisPoints',
	'listingMinimumDownlinkMbps',
	'listingMinimumUplinkMbps',
	'listingMinimumDiskRandomReadIops',
	'listingMinimumDiskSequentialMibps',
	'verifiedMinimumListedDays',
	'verifiedMinimumUptimeBasisPoints',
	'verifiedMinimumSpotChecks',
	'spotCheckIntervalHoursCommunity',
	'spotCheckIntervalHoursVerified',
	'spotCheckMonthlyBudgetCents',
	'spotCheckToleranceBasisPoints',
	'autoTopUpMinimumCents',
	'autoTopUpMinimumIntervalMinutes',
	'topUpAttemptsPerHour',
	'paymentMethodsPerDay',
	'organizationsPerCardFingerprint',
	'payoutMinimumCents',
	'payoutHoldCommunityDays',
	'payoutHoldVerifiedDays',
	'payoutHoldDatacenterDays',
	'newFundingHoldDays',
] as const;

const POSITIVE_COLUMNS = [
	'priceFloorMinimumSamples',
	'priceLockDays',
	'leaseRenewalGraceDays',
	'stoppedSandboxRetentionDays',
	'pinnedStartWaitMinutes',
	'egressCeilingMedianBasisPoints',
	'exposureCeilingProbationaryCents',
	'exposureCeilingEstablishedCents',
	'exposureCeilingHostCents',
	'topUpMinimumCents',
] as const;

const BASIS_POINTS_COLUMNS = [
	'platformMarkupBasisPoints',
	'priceFloorBasisPoints',
	'verifiedMinimumUptimeBasisPoints',
	'spotCheckToleranceBasisPoints',
] as const;

const integerColumn = (fieldName: string) =>
	({ type: 'integer', columnType: 'integer', fieldName }) as const;

const booleanColumn = (fieldName: string) =>
	({ type: 'boolean', fieldName }) as const;

@Entity({ tableName: 'settings' })
@Check({
	name: 'CHK_settings_singleton',
	expression: `"id" = ${SETTINGS_ID}`,
})
@Check({
	name: 'CHK_settings_non_negative',
	expression: NON_NEGATIVE_COLUMNS.map((column) => `"${column}" >= 0`).join(
		' and '
	),
})
@Check({
	name: 'CHK_settings_positive',
	expression: POSITIVE_COLUMNS.map(
		(column) => `"${column}" >= ${SETTINGS_POSITIVE_MINIMUM}`
	).join(' and '),
})
@Check({
	name: 'CHK_settings_basis_points',
	expression: BASIS_POINTS_COLUMNS.map(
		(column) => `"${column}" <= ${BASIS_POINTS_SCALE}`
	).join(' and '),
})
@Check({
	name: 'CHK_settings_network_budget_throttle',
	expression: `"networkBudgetThrottleBandwidthBps" >= ${MINIMUM_EGRESS_BANDWIDTH_BPS} and "networkBudgetThrottleBandwidthBps" <= ${MAXIMUM_EGRESS_BANDWIDTH_BPS}`,
})
@Check({
	name: 'CHK_settings_top_up_range',
	expression: '"topUpMaximumCents" >= "topUpMinimumCents"',
})
@Check({
	name: 'CHK_settings_payout_weekday',
	expression: `"payoutWeekday" >= ${ISO_WEEKDAY.MONDAY} and "payoutWeekday" <= ${ISO_WEEKDAY.SUNDAY}`,
})
@Check({
	name: 'CHK_settings_draining_mode',
	expression: `"drainingMode" in (${sqlList(Object.values(DrainingMode))})`,
})
@Check({
	name: 'CHK_settings_sandbox_class',
	expression: `"defaultSandboxClass" in (${sqlList(Object.values(SandboxClass))})`,
})
@Check({
	name: 'CHK_settings_version',
	expression: '"resourceVersion" > 0',
})
export class Settings {
	@PrimaryKey({ type: 'integer', columnType: 'smallint', autoincrement: false })
	id: number = SETTINGS_ID;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'defaultSnapshot',
		nullable: true,
	})
	defaultSnapshot: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'defaultSandboxClass',
	})
	defaultSandboxClass: SandboxClass;

	@Property(booleanColumn('sandboxDefaultLimitedNetworkEgress'))
	sandboxDefaultLimitedNetworkEgress: boolean;

	@Property(integerColumn('totalCpuQuota'))
	totalCpuQuota: number;

	@Property(integerColumn('totalMemoryQuota'))
	totalMemoryQuota: number;

	@Property(integerColumn('totalDiskQuota'))
	totalDiskQuota: number;

	@Property(integerColumn('maxCpuPerSandbox'))
	maxCpuPerSandbox: number;

	@Property(integerColumn('maxMemoryPerSandbox'))
	maxMemoryPerSandbox: number;

	@Property(integerColumn('maxDiskPerSandbox'))
	maxDiskPerSandbox: number;

	@Property(integerColumn('snapshotQuota'))
	snapshotQuota: number;

	@Property(integerColumn('maxSnapshotSize'))
	maxSnapshotSize: number;

	@Property(integerColumn('volumeQuota'))
	volumeQuota: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'machineGuestRegistryUrl',
		nullable: true,
	})
	machineGuestRegistryUrl: string | null;

	@Property(booleanColumn('machineDesktopEnabled'))
	machineDesktopEnabled: boolean;

	@Property(booleanColumn('machineSerialConsoleEnabled'))
	machineSerialConsoleEnabled: boolean;

	@Property(booleanColumn('publicIngressEnabled'))
	publicIngressEnabled: boolean;

	@Property(integerColumn('platformMarkupBasisPoints'))
	platformMarkupBasisPoints: number;

	@Property(integerColumn('priceFloorBasisPoints'))
	priceFloorBasisPoints: number;

	@Property(integerColumn('priceFloorMinimumSamples'))
	priceFloorMinimumSamples: number;

	@Property(integerColumn('priceLockDays'))
	priceLockDays: number;

	@Property(integerColumn('leaseRenewalGraceDays'))
	leaseRenewalGraceDays: number;

	@Property(integerColumn('stoppedSandboxRetentionDays'))
	stoppedSandboxRetentionDays: number;

	@Property(integerColumn('pinnedStartWaitMinutes'))
	pinnedStartWaitMinutes: number;

	@Property(integerColumn('egressPriceCeilingMicroUsdPerGiB'))
	egressPriceCeilingMicroUsdPerGiB: number;

	@Property(integerColumn('egressCeilingMedianBasisPoints'))
	egressCeilingMedianBasisPoints: number;

	@Property(integerColumn('networkBudgetThrottleBandwidthBps'))
	networkBudgetThrottleBandwidthBps: number;

	@Property(integerColumn('exposureCeilingProbationaryCents'))
	exposureCeilingProbationaryCents: number;

	@Property(integerColumn('exposureCeilingEstablishedCents'))
	exposureCeilingEstablishedCents: number;

	@Property(integerColumn('exposureCeilingHostCents'))
	exposureCeilingHostCents: number;

	@Property(integerColumn('listingMinimumDownlinkMbps'))
	listingMinimumDownlinkMbps: number;

	@Property(integerColumn('listingMinimumUplinkMbps'))
	listingMinimumUplinkMbps: number;

	@Property(integerColumn('listingMinimumDiskRandomReadIops'))
	listingMinimumDiskRandomReadIops: number;

	@Property(integerColumn('listingMinimumDiskSequentialMibps'))
	listingMinimumDiskSequentialMibps: number;

	@Property(integerColumn('verifiedMinimumListedDays'))
	verifiedMinimumListedDays: number;

	@Property(integerColumn('verifiedMinimumUptimeBasisPoints'))
	verifiedMinimumUptimeBasisPoints: number;

	@Property(integerColumn('verifiedMinimumSpotChecks'))
	verifiedMinimumSpotChecks: number;

	@Property(integerColumn('spotCheckIntervalHoursCommunity'))
	spotCheckIntervalHoursCommunity: number;

	@Property(integerColumn('spotCheckIntervalHoursVerified'))
	spotCheckIntervalHoursVerified: number;

	@Property(integerColumn('spotCheckMonthlyBudgetCents'))
	spotCheckMonthlyBudgetCents: number;

	@Property(integerColumn('spotCheckToleranceBasisPoints'))
	spotCheckToleranceBasisPoints: number;

	@ManyToOne({
		entity: () => Organization,
		joinColumn: 'spotCheckOrganizationId',
		columnType: 'uuid',
		nullable: true,
		mapToPk: true,
		deleteRule: 'restrict',
		foreignKeyName: 'settings_spotCheckOrganizationId_fk',
	})
	spotCheckOrganizationId: string | null;

	@Property(integerColumn('topUpMinimumCents'))
	topUpMinimumCents: number;

	@Property(integerColumn('topUpMaximumCents'))
	topUpMaximumCents: number;

	@Property({
		type: new ArrayType<number>(Number),
		columnType: 'integer[]',
		fieldName: 'topUpPresetsCents',
	})
	topUpPresetsCents: number[];

	@Property(integerColumn('autoTopUpMinimumCents'))
	autoTopUpMinimumCents: number;

	@Property(integerColumn('autoTopUpMinimumIntervalMinutes'))
	autoTopUpMinimumIntervalMinutes: number;

	@Property(integerColumn('topUpAttemptsPerHour'))
	topUpAttemptsPerHour: number;

	@Property(integerColumn('paymentMethodsPerDay'))
	paymentMethodsPerDay: number;

	@Property(integerColumn('organizationsPerCardFingerprint'))
	organizationsPerCardFingerprint: number;

	@Property(integerColumn('payoutMinimumCents'))
	payoutMinimumCents: number;

	@Property(integerColumn('payoutWeekday'))
	payoutWeekday: number;

	@Property(integerColumn('payoutHoldCommunityDays'))
	payoutHoldCommunityDays: number;

	@Property(integerColumn('payoutHoldVerifiedDays'))
	payoutHoldVerifiedDays: number;

	@Property(integerColumn('payoutHoldDatacenterDays'))
	payoutHoldDatacenterDays: number;

	@Property(integerColumn('newFundingHoldDays'))
	newFundingHoldDays: number;

	@Property(booleanColumn('stripeTaxEnabled'))
	stripeTaxEnabled: boolean;

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		fieldName: 'payoutCountries',
	})
	payoutCountries: string[];

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		fieldName: 'edgeTrustedHttpProxyCidrs',
		defaultRaw: `'{}'`,
	})
	edgeTrustedHttpProxyCidrs: string[];

	@Property(booleanColumn('maintenanceMode'))
	maintenanceMode: boolean;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'drainingMode',
	})
	drainingMode: DrainingMode;

	@Property(booleanColumn('drainingForce'))
	drainingForce: boolean;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'resourceVersion',
		version: true,
		default: SETTINGS_RESOURCE_VERSION_INITIAL,
	})
	resourceVersion = SETTINGS_RESOURCE_VERSION_INITIAL;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'updatedBy',
		nullable: true,
	})
	updatedBy: string | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}
