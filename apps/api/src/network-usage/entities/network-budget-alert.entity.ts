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
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';
import {
	NETWORK_USAGE_NUMERIC_PRECISION,
	NETWORK_USAGE_NUMERIC_SCALE,
} from '../constants/network-usage.constants';

const amountColumn = (fieldName: string) =>
	({
		type: DecimalType,
		columnType: `numeric(${NETWORK_USAGE_NUMERIC_PRECISION},${NETWORK_USAGE_NUMERIC_SCALE})`,
		runtimeType: 'string',
		fieldName,
	}) as const;

@Entity({ tableName: 'network_budget_alert' })
@Unique({
	name: 'UQ_network_budget_alert_threshold',
	properties: ['organizationId', 'monthStart', 'thresholdBasisPoints'],
})
@Check({
	name: 'CHK_network_budget_alert_values',
	expression:
		'"thresholdBasisPoints" > 0 and "spendMicroUsd" >= 0 and "limitMicroUsd" > 0',
})
export class NetworkBudgetAlert {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_network_budget_alert_organization',
	})
	organizationId: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'monthStart',
	})
	monthStart: Date;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'thresholdBasisPoints',
	})
	thresholdBasisPoints: number;

	@Property(amountColumn('spendMicroUsd'))
	spendMicroUsd: string;

	@Property(amountColumn('limitMicroUsd'))
	limitMicroUsd: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
