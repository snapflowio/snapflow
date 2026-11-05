/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DecimalType, PrimaryKeyProp } from '@mikro-orm/core';
import {
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';
import type { BillingBudgetMode } from '../constants/billing.constants';

@Entity({ tableName: 'billing_budget_version' })
@Index({
	name: 'IDX_billing_budget_version_history',
	properties: ['organizationId', 'updatedAt'],
})
export class BillingBudgetVersion {
	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		primary: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_billing_budget_version_organization',
	})
	organizationId: string;

	@PrimaryKey({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'resourceVersion',
	})
	resourceVersion: number;

	@Property({
		type: new DecimalType('string'),
		columnType: 'numeric(40,0)',
		fieldName: 'monthlyLimitMicroUsd',
	})
	monthlyLimitMicroUsd: string;

	@Property({
		type: new DecimalType('string'),
		columnType: 'numeric(40,0)',
		fieldName: 'networkLimitMicroUsd',
		nullable: true,
	})
	networkLimitMicroUsd: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	mode: BillingBudgetMode;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'warningThresholdBasisPoints',
	})
	warningThresholdBasisPoints: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'desiredMinimumRunwayMinutes',
	})
	desiredMinimumRunwayMinutes: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'updatedBy',
	})
	updatedBy: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
	})
	updatedAt: Date;

	[PrimaryKeyProp]?: ['organizationId', 'resourceVersion'];
}
