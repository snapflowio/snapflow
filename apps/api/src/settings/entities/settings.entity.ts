/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Check,
	Entity,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import { Organization } from '../../organization/entities/organization.entity';
import type { QuotaTier } from '../../organization/types/quota-tier.types';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { MAXIMUM_MARKUP_BASIS_POINTS } from '../../settlement/constants/settlement.constants';
import {
	AbuseEnforcementMode,
	ARCHIVE_AFTER_STOPPED_DAYS,
	DrainingMode,
	SANDBOX_BANDWIDTH_LIMIT_MBPS,
	SANDBOX_BURST_MIB,
	SANDBOX_HOST_LINK_SHARE_BASIS_POINTS,
	SANDBOX_MAX_CONNECTIONS,
	SANDBOX_NEW_CONNECTIONS_PER_SECOND,
	SANDBOX_PACKETS_PER_SECOND,
	SETTINGS_ID,
	SETTINGS_POSITIVE_MINIMUM,
	SETTINGS_RESOURCE_VERSION_INITIAL,
} from '../constants/settings.constants';

const sqlList = (values: readonly string[]) =>
	values.map((value) => `'${value}'`).join(', ');

const NON_NEGATIVE_COLUMNS = [
	'maxCpuPerSandbox',
	'maxMemoryPerSandbox',
	'maxDiskPerSandbox',
	'markupBasisPoints',
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
	'settlementConfirmations',
	'largeDepositConfirmations',
	'largeDepositThresholdCents',
	'hostPayoutMinimumCents',
	'minimumDepositCents',
	'storageMicroUsdPerGibMonth',
	'relayFeeMarginBasisPoints',
] as const;

const POSITIVE_COLUMNS = [
	'priceLockDays',
	'startWaitMinutes',
	'delegatedSignerMinimumHourlyCapCents',
	'exposureCeilingProbationaryCents',
	'exposureCeilingEstablishedCents',
	'exposureCeilingHostCents',
	'voucherIntervalSeconds',
	'voucherGraceIntervals',
	'storageCapGibDefault',
	'walletFeeCapBasisPoints',
	'archiveAfterMachineOfflineMinutes',
	'fundsStopMarginMinutes',
] as const;

const BASIS_POINTS_COLUMNS = [
	'verifiedMinimumUptimeBasisPoints',
	'spotCheckToleranceBasisPoints',
] as const;

const BOUNDED_COLUMNS = [
	['sandboxUploadBandwidthLimitMbps', SANDBOX_BANDWIDTH_LIMIT_MBPS],
	['sandboxDownloadBandwidthLimitMbps', SANDBOX_BANDWIDTH_LIMIT_MBPS],
	['sandboxBurstMib', SANDBOX_BURST_MIB],
	['sandboxPacketsPerSecondLimit', SANDBOX_PACKETS_PER_SECOND],
	['sandboxNewConnectionsPerSecond', SANDBOX_NEW_CONNECTIONS_PER_SECOND],
	['sandboxMaxConnections', SANDBOX_MAX_CONNECTIONS],
	['sandboxHostLinkShareBasisPoints', SANDBOX_HOST_LINK_SHARE_BASIS_POINTS],
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
	name: 'CHK_settings_archive_after_stopped_days',
	expression: `"archiveAfterStoppedDaysDefault" between ${ARCHIVE_AFTER_STOPPED_DAYS.MINIMUM} and ${ARCHIVE_AFTER_STOPPED_DAYS.MAXIMUM}`,
})
@Check({
	name: 'CHK_settings_sandbox_traffic',
	expression: BOUNDED_COLUMNS.map(
		([column, range]) =>
			`"${column}" between ${range.MINIMUM} and ${range.MAXIMUM}`
	).join(' and '),
})
@Check({
	name: 'CHK_settings_abuse_enforcement_mode',
	expression: `"abuseEnforcementMode" in (${sqlList(Object.values(AbuseEnforcementMode))})`,
})
@Check({
	name: 'CHK_settings_markup',
	expression: `"markupBasisPoints" <= ${MAXIMUM_MARKUP_BASIS_POINTS}`,
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

	@Property(integerColumn('maxCpuPerSandbox'))
	maxCpuPerSandbox: number;

	@Property(integerColumn('maxMemoryPerSandbox'))
	maxMemoryPerSandbox: number;

	@Property(integerColumn('maxDiskPerSandbox'))
	maxDiskPerSandbox: number;

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

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'minimumMachineReleaseVersion',
		nullable: true,
	})
	minimumMachineReleaseVersion: string | null;

	@Property(booleanColumn('publicIngressEnabled'))
	publicIngressEnabled: boolean;

	@Property(integerColumn('markupBasisPoints'))
	markupBasisPoints: number;

	@Property(integerColumn('priceLockDays'))
	priceLockDays: number;

	@Property(integerColumn('startWaitMinutes'))
	startWaitMinutes: number;

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

	@Property(integerColumn('settlementConfirmations'))
	settlementConfirmations: number;

	@Property(integerColumn('largeDepositConfirmations'))
	largeDepositConfirmations: number;

	@Property(integerColumn('largeDepositThresholdCents'))
	largeDepositThresholdCents: number;

	@Property(integerColumn('voucherIntervalSeconds'))
	voucherIntervalSeconds: number;

	@Property(integerColumn('voucherGraceIntervals'))
	voucherGraceIntervals: number;

	@Property(integerColumn('hostPayoutMinimumCents'))
	hostPayoutMinimumCents: number;

	@Property(integerColumn('minimumDepositCents'))
	minimumDepositCents: number;

	@Property(integerColumn('delegatedSignerMinimumHourlyCapCents'))
	delegatedSignerMinimumHourlyCapCents: number;

	@Property(integerColumn('fundsStopMarginMinutes'))
	fundsStopMarginMinutes: number;

	@Property({ type: 'json', columnType: 'jsonb', fieldName: 'quotaTiers' })
	quotaTiers: QuotaTier[];

	@Property(integerColumn('relayFeeMarginBasisPoints'))
	relayFeeMarginBasisPoints: number;

	@Property(integerColumn('walletFeeCapBasisPoints'))
	walletFeeCapBasisPoints: number;

	@Property(integerColumn('storageMicroUsdPerGibMonth'))
	storageMicroUsdPerGibMonth: number;

	@Property(integerColumn('storageCapGibDefault'))
	storageCapGibDefault: number;

	@Property(integerColumn('sandboxUploadBandwidthLimitMbps'))
	sandboxUploadBandwidthLimitMbps: number;

	@Property(integerColumn('sandboxDownloadBandwidthLimitMbps'))
	sandboxDownloadBandwidthLimitMbps: number;

	@Property(integerColumn('sandboxBurstMib'))
	sandboxBurstMib: number;

	@Property(integerColumn('sandboxPacketsPerSecondLimit'))
	sandboxPacketsPerSecondLimit: number;

	@Property(integerColumn('sandboxNewConnectionsPerSecond'))
	sandboxNewConnectionsPerSecond: number;

	@Property(integerColumn('sandboxMaxConnections'))
	sandboxMaxConnections: number;

	@Property(integerColumn('sandboxHostLinkShareBasisPoints'))
	sandboxHostLinkShareBasisPoints: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'abuseEnforcementMode',
	})
	abuseEnforcementMode: AbuseEnforcementMode;

	@Property(integerColumn('archiveAfterStoppedDaysDefault'))
	archiveAfterStoppedDaysDefault: number;

	@Property(integerColumn('archiveAfterMachineOfflineMinutes'))
	archiveAfterMachineOfflineMinutes: number;

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
