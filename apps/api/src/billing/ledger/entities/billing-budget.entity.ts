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
	ManyToOne,
	Property,
} from '@mikro-orm/decorators/legacy';
import { BASIS_POINTS_SCALE } from '../../../common/constants/money.constants';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import {
	BillingBudgetMode,
	type BillingBudgetMode as BudgetMode,
	DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS,
} from '../constants/billing.constants';

const billingBudgetModes = Object.values(BillingBudgetMode)
	.map((mode) => `'${mode}'`)
	.join(', ');

@Entity({ tableName: 'billing_budget' })
@Check({
	name: 'CHK_billing_budget_version',
	expression: '"resourceVersion" > 0',
})
@Check({
	name: 'CHK_billing_budget_amounts',
	expression:
		'"monthlyLimitMicroUsd" > 0 and ("networkLimitMicroUsd" is null or "networkLimitMicroUsd" > 0)',
})
@Check({
	name: 'CHK_billing_budget_mode',
	expression: `mode in (${billingBudgetModes})`,
})
@Check({
	name: 'CHK_billing_budget_warning',
	expression: `"warningThresholdBasisPoints" >= 1 and "warningThresholdBasisPoints" <= ${BASIS_POINTS_SCALE}`,
})
@Check({
	name: 'CHK_billing_budget_runway',
	expression: '"desiredMinimumRunwayMinutes" > 0',
})
export class BillingBudget {
	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		primary: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'billing_budget_organizationId_fkey',
	})
	organizationId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'resourceVersion',
		default: 1,
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
		default: BillingBudgetMode.ALERT,
	})
	mode: BudgetMode;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'warningThresholdBasisPoints',
		default: DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS,
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
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}
