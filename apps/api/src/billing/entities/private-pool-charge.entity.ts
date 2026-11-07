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
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';
import {
	BILLING_NUMERIC_PRECISION,
	BILLING_NUMERIC_SCALE,
} from '../constants/billing.constants';

const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

// One UTC day one machine spent in its organization's private pool, and the
// share of the monthly private pool fee it costs. A day is charged once,
// however often the machine enters or leaves the pool that day.
@Entity({ tableName: 'private_pool_charge' })
@Unique({
	name: 'UQ_private_pool_charge_machine_day',
	properties: ['machineId', 'serviceDay'],
})
@Index({
	name: 'IDX_private_pool_charge_organization',
	properties: ['organizationId', 'serviceDay'],
})
@Check({
	name: 'CHK_private_pool_charge_amount',
	expression: '"amountMicroUsd" >= 0',
})
export class PrivatePoolCharge {
	[OptionalProps]?: 'id' | 'createdAt';

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
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_private_pool_charge_organization',
	})
	organizationId: string;

	@Property({ type: 'uuid', columnType: 'uuid', fieldName: 'machineId' })
	machineId: string;

	// The first instant of the charged UTC day.
	@Property(timestampColumn('serviceDay'))
	serviceDay: Date;

	@Property({
		type: DecimalType,
		columnType: `numeric(${BILLING_NUMERIC_PRECISION.MONEY},${BILLING_NUMERIC_SCALE.MONEY})`,
		runtimeType: 'string',
		fieldName: 'amountMicroUsd',
	})
	amountMicroUsd: string;

	@Property({
		...timestampColumn('createdAt'),
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
