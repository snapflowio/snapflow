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
} from '@mikro-orm/decorators/legacy';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { Organization } from '../../organization/entities/organization.entity';
import {
	BILLING_NUMERIC_PRECISION,
	BILLING_NUMERIC_SCALE,
	PlacementFundingState,
	type PlacementFundingState as PlacementFundingStateValue,
} from '../constants/billing.constants';

const fundingStates = Object.values(PlacementFundingState)
	.map((value) => `'${value}'`)
	.join(', ');

@Entity({ tableName: 'placement_billing_authorization' })
@Index({
	name: 'IDX_placement_billing_authorization_customer',
	properties: ['customerOrganizationId', 'expiresAt'],
})
@Index({
	name: 'IDX_placement_billing_authorization_host',
	properties: ['hostOrganizationId', 'expiresAt'],
})
@Check({
	name: 'CHK_placement_billing_authorization_amounts',
	expression:
		'"estimatedHourlyMicroUsd" >= 0 and "reservedMicroUsd" >= 0 and "remainingReservedMicroUsd" >= 0',
})
@Check({
	name: 'CHK_placement_billing_authorization_funding_state',
	expression: `"fundingState" in (${fundingStates})`,
})
export class PlacementBillingAuthorization {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'placementId',
	})
	placementId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxId',
	})
	sandboxId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'customerOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_placement_billing_authorization_customer_organization',
	})
	customerOrganizationId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'hostOrganizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_placement_billing_authorization_host_organization',
	})
	hostOrganizationId: string;

	@ManyToOne({
		entity: () => SandboxLease,
		mapToPk: true,
		joinColumn: 'leaseId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_placement_billing_authorization_lease',
	})
	leaseId: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${BILLING_NUMERIC_PRECISION.MONEY},${BILLING_NUMERIC_SCALE.MONEY})`,
		runtimeType: 'string',
		fieldName: 'estimatedHourlyMicroUsd',
	})
	estimatedHourlyMicroUsd: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${BILLING_NUMERIC_PRECISION.MONEY},${BILLING_NUMERIC_SCALE.MONEY})`,
		runtimeType: 'string',
		fieldName: 'reservedMicroUsd',
	})
	reservedMicroUsd: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${BILLING_NUMERIC_PRECISION.MONEY},${BILLING_NUMERIC_SCALE.MONEY})`,
		runtimeType: 'string',
		fieldName: 'remainingReservedMicroUsd',
	})
	remainingReservedMicroUsd: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'createdBy',
	})
	createdBy: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
	})
	createdAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'expiresAt',
	})
	expiresAt: Date;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'fundingState',
		default: PlacementFundingState.HEALTHY,
	})
	fundingState: PlacementFundingStateValue = PlacementFundingState.HEALTHY;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'fundingStateChangedAt',
		defaultRaw: 'now()',
	})
	fundingStateChangedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'billingCutoffAt',
		nullable: true,
	})
	billingCutoffAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'releasedAt',
		nullable: true,
	})
	releasedAt: Date | null;
}
