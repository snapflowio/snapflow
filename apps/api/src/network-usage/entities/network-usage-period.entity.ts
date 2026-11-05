/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DecimalType } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import { Machine } from '../../machine/entities/machine.entity';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import {
	NETWORK_USAGE_NUMERIC_PRECISION,
	NETWORK_USAGE_NUMERIC_SCALE,
} from '../constants/network-usage.constants';

const NETWORK_PERIOD_AMOUNT_COLUMNS = [
	'edgeEgressBytes',
	'edgeIngressBytes',
	'internetEgressBytes',
	'internetIngressBytes',
	'hostEgressBytes',
	'hostIngressBytes',
	'clampedInternetEgressBytes',
	'billedEgressBytes',
	'egressRateMicroUsdPerGiB',
	'hostMicroUsd',
	'markupMicroUsd',
	'grossMicroUsd',
] as const;

const amountColumn = (
	fieldName: (typeof NETWORK_PERIOD_AMOUNT_COLUMNS)[number]
) =>
	({
		type: DecimalType,
		columnType: `numeric(${NETWORK_USAGE_NUMERIC_PRECISION},${NETWORK_USAGE_NUMERIC_SCALE})`,
		runtimeType: 'string',
		fieldName,
	}) as const;

@Entity({ tableName: 'network_usage_period' })
@Unique({
	name: 'UQ_network_usage_period_lease_start_supplement',
	properties: ['leaseId', 'periodStart', 'supplement'],
})
@Index({
	name: 'IDX_network_usage_period_customer',
	properties: ['customerOrganizationId', 'periodStart'],
})
@Index({
	name: 'IDX_network_usage_period_host',
	properties: ['hostOrganizationId', 'periodStart'],
})
@Index({
	name: 'IDX_network_usage_period_placement',
	properties: ['placementId', 'periodStart'],
})
@Check({
	name: 'CHK_network_usage_period_amounts',
	expression: NETWORK_PERIOD_AMOUNT_COLUMNS.map(
		(column) => `"${column}" >= 0`
	).join(' and '),
})
@Check({
	name: 'CHK_network_usage_period_billed',
	expression:
		'"billedEgressBytes" = "edgeEgressBytes" + "internetEgressBytes" and "grossMicroUsd" = "hostMicroUsd" + "markupMicroUsd"',
})
@Check({
	name: 'CHK_network_usage_period_window',
	expression: '"periodEnd" > "periodStart"',
})
@Check({
	name: 'CHK_network_usage_period_markup',
	expression: `"markupBasisPoints" >= 0 and "markupBasisPoints" <= ${BASIS_POINTS_SCALE}`,
})
@Check({
	name: 'CHK_network_usage_period_evidence',
	expression:
		'"assignmentGeneration" > 0 and "supplement" >= 0 and "receiptCount" >= 0 and "edgeSampleCount" >= 0',
})
export class NetworkUsagePeriod {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => SandboxLease,
		mapToPk: true,
		joinColumn: 'leaseId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_network_usage_period_lease',
	})
	leaseId: string;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumn: 'placementId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_network_usage_period_placement',
	})
	placementId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxId',
	})
	sandboxId: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_network_usage_period_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'customerOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_network_usage_period_customer',
	})
	customerOrganizationId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'hostOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_network_usage_period_host',
	})
	hostOrganizationId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'periodStart',
	})
	periodStart: Date;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'supplement',
		default: 0,
	})
	supplement = 0;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'periodEnd',
	})
	periodEnd: Date;

	@Property(amountColumn('edgeEgressBytes'))
	edgeEgressBytes: string;

	@Property(amountColumn('edgeIngressBytes'))
	edgeIngressBytes: string;

	@Property(amountColumn('internetEgressBytes'))
	internetEgressBytes: string;

	@Property(amountColumn('internetIngressBytes'))
	internetIngressBytes: string;

	@Property(amountColumn('hostEgressBytes'))
	hostEgressBytes: string;

	@Property(amountColumn('hostIngressBytes'))
	hostIngressBytes: string;

	@Property(amountColumn('clampedInternetEgressBytes'))
	clampedInternetEgressBytes: string;

	@Property(amountColumn('billedEgressBytes'))
	billedEgressBytes: string;

	@Property(amountColumn('egressRateMicroUsdPerGiB'))
	egressRateMicroUsdPerGiB: string;

	@Property(amountColumn('hostMicroUsd'))
	hostMicroUsd: string;

	@Property(amountColumn('markupMicroUsd'))
	markupMicroUsd: string;

	@Property(amountColumn('grossMicroUsd'))
	grossMicroUsd: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'markupBasisPoints',
	})
	markupBasisPoints: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'receiptCount',
	})
	receiptCount: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'edgeSampleCount',
	})
	edgeSampleCount: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
