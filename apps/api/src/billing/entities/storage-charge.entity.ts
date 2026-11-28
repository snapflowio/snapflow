/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BigIntType, DecimalType, OptionalProps } from '@mikro-orm/core';
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
	BILLING_NUMERIC_PRECISION,
	BILLING_NUMERIC_SCALE,
} from '../constants/billing.constants';

const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

@Entity({ tableName: 'storage_charge' })
@Unique({
	name: 'UQ_storage_charge_organization_hour',
	properties: ['organizationId', 'serviceHour'],
})
@Check({
	name: 'CHK_storage_charge_amounts',
	expression: '"storedBytes" >= 0 and "amountMicroUsd" >= 0',
})
export class StorageCharge {
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
		foreignKeyName: 'FK_storage_charge_organization',
	})
	organizationId: string;

	@Property(timestampColumn('serviceHour'))
	serviceHour: Date;

	@Property({
		type: BigIntType,
		columnType: 'bigint',
		runtimeType: 'string',
		fieldName: 'storedBytes',
	})
	storedBytes: string;

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
