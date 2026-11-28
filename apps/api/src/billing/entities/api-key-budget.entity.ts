/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DecimalType, OptionalProps } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	Property,
} from '@mikro-orm/decorators/legacy';
import { ApiKey } from '../../auth/entities/api-key.entity';
import { Organization } from '../../organization/entities/organization.entity';
import {
	BILLING_NUMERIC_PRECISION,
	BILLING_NUMERIC_SCALE,
} from '../constants/billing.constants';

@Entity({ tableName: 'api_key_budget' })
@Index({
	name: 'IDX_api_key_budget_organization',
	properties: ['organizationId'],
})
@Check({
	name: 'CHK_api_key_budget_limits',
	expression:
		'("computeSpendLimitMicroUsd" is null or "computeSpendLimitMicroUsd" > 0) and ("maxConcurrentSandboxes" is null or "maxConcurrentSandboxes" > 0)',
})
export class ApiKeyBudget {
	[OptionalProps]?: 'updatedAt';

	@ManyToOne({
		entity: () => ApiKey,
		mapToPk: true,
		primary: true,
		joinColumn: 'apiKeyId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_api_key_budget_api_key',
	})
	apiKeyId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_api_key_budget_organization',
	})
	organizationId: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${BILLING_NUMERIC_PRECISION.MONEY},${BILLING_NUMERIC_SCALE.MONEY})`,
		runtimeType: 'string',
		fieldName: 'computeSpendLimitMicroUsd',
		nullable: true,
	})
	computeSpendLimitMicroUsd: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'maxConcurrentSandboxes',
		nullable: true,
	})
	maxConcurrentSandboxes: number | null;

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
