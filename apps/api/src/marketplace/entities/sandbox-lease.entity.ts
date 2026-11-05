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
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Organization } from '../../organization/entities/organization.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import { Machine } from '../../sandbox/machine/entities/machine.entity';
import { MARKETPLACE_MONEY_COLUMN_TYPE } from '../constants/marketplace.constants';
import { LeaseEndReason } from '../enums/lease-end-reason.enum';
import { LeaseRenewalState } from '../enums/lease-renewal-state.enum';
import { PlacementKind } from '../enums/placement-kind.enum';
import { MachinePriceCard } from './machine-price-card.entity';

const OPEN_LEASE = '"endedAt" is null';

const integerColumn = (fieldName: string) =>
	({ type: 'integer', columnType: 'integer', fieldName }) as const;

const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

const nullableTimestampColumn = (fieldName: string) =>
	({ ...timestampColumn(fieldName), nullable: true }) as const;

@Entity({ tableName: 'sandbox_lease' })
@Unique({
	name: 'UQ_sandbox_lease_open',
	properties: ['sandboxId'],
	where: OPEN_LEASE,
})
@Index({
	name: 'IDX_sandbox_lease_machine_open',
	properties: ['machineId'],
	where: OPEN_LEASE,
})
@Index({
	name: 'IDX_sandbox_lease_lock',
	properties: ['priceLockedUntil'],
	where: OPEN_LEASE,
})
@Check({
	name: 'CHK_sandbox_lease_self_use',
	expression:
		'("priceCardId" is null) = ("customerOrganizationId" = "hostOrganizationId")',
})
@Check({
	name: 'CHK_sandbox_lease_markup',
	expression: `"markupBasisPoints" >= 0 and "markupBasisPoints" <= ${BASIS_POINTS_SCALE}`,
})
@Check({
	name: 'CHK_sandbox_lease_end',
	expression: '("endedAt" is null) = ("endReason" is null)',
})
@Check({
	name: 'CHK_sandbox_lease_renewal',
	expression: `"renewalState" = '${LeaseRenewalState.NONE}' or "renewalDeadline" is not null`,
})
@Check({
	name: 'CHK_sandbox_lease_placement_kind',
	expression: `"placementKind" in (${sqlValueList(PlacementKind)})`,
})
@Check({
	name: 'CHK_sandbox_lease_renewal_state',
	expression: `"renewalState" in (${sqlValueList(LeaseRenewalState)})`,
})
@Check({
	name: 'CHK_sandbox_lease_end_reason',
	expression: `"endReason" is null or "endReason" in (${sqlValueList(LeaseEndReason)})`,
})
@Check({
	name: 'CHK_sandbox_lease_shape',
	expression:
		'"cpu" >= 0 and "memoryGib" >= 0 and "diskGib" >= 0 and "gpu" >= 0',
})
export class SandboxLease {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_lease_sandbox',
	})
	sandboxId: string;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumn: 'placementId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_lease_placement',
	})
	placementId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'customerOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_lease_customer_organization',
	})
	customerOrganizationId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'hostOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_lease_host_organization',
	})
	hostOrganizationId: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_lease_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => MachinePriceCard,
		mapToPk: true,
		joinColumn: 'priceCardId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_lease_price_card',
	})
	priceCardId: string | null = null;

	@Property(integerColumn('markupBasisPoints'))
	markupBasisPoints: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'placementKind',
	})
	placementKind: PlacementKind;

	@Property({
		type: DecimalType,
		columnType: MARKETPLACE_MONEY_COLUMN_TYPE,
		runtimeType: 'string',
		fieldName: 'maxHourlyPriceMicroUsd',
		nullable: true,
	})
	maxHourlyPriceMicroUsd: string | null = null;

	@Property({
		type: DecimalType,
		columnType: MARKETPLACE_MONEY_COLUMN_TYPE,
		runtimeType: 'string',
		fieldName: 'maxEgressMicroUsdPerGiB',
		nullable: true,
	})
	maxEgressMicroUsdPerGiB: string | null = null;

	@Property(integerColumn('cpu'))
	cpu: number;

	@Property(integerColumn('memoryGib'))
	memoryGib: number;

	@Property(integerColumn('diskGib'))
	diskGib: number;

	@Property(integerColumn('gpu'))
	gpu: number;

	@Property(timestampColumn('startedAt'))
	startedAt: Date;

	@Property(timestampColumn('priceLockedUntil'))
	priceLockedUntil: Date;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'renewalState',
		default: LeaseRenewalState.NONE,
	})
	renewalState: LeaseRenewalState = LeaseRenewalState.NONE;

	@Property(nullableTimestampColumn('renewalDeadline'))
	renewalDeadline: Date | null = null;

	@Property(nullableTimestampColumn('endedAt'))
	endedAt: Date | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'endReason',
		nullable: true,
	})
	endReason: LeaseEndReason | null = null;
}
