/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import { CARD_LAST_DIGITS_LENGTH } from '../constants/payments.constants';

const varcharColumn = (fieldName: string) =>
	({ type: 'string', columnType: 'varchar', fieldName }) as const;

const integerColumn = (fieldName: string) =>
	({ type: 'integer', columnType: 'integer', fieldName }) as const;

const nullableTimestampColumn = (fieldName: string) =>
	({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName,
		nullable: true,
	}) as const;

@Entity({ tableName: 'payment_method' })
@Unique({
	name: 'UQ_payment_method_stripe_payment_method',
	properties: ['stripePaymentMethodId'],
})
@Index({
	name: 'IDX_payment_method_card_fingerprint',
	properties: ['cardFingerprint'],
})
export class PaymentMethod {
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
		foreignKeyName: 'FK_payment_method_organization',
	})
	organizationId: string;

	@Property(varcharColumn('stripePaymentMethodId'))
	stripePaymentMethodId: string;

	@Property(varcharColumn('cardFingerprint'))
	cardFingerprint: string;

	@Property(varcharColumn('brand'))
	brand: string;

	@Property({
		type: 'string',
		columnType: `varchar(${CARD_LAST_DIGITS_LENGTH})`,
		fieldName: 'last4',
	})
	last4: string;

	@Property(integerColumn('expMonth'))
	expMonth: number;

	@Property(integerColumn('expYear'))
	expYear: number;

	@Property(nullableTimestampColumn('firstChargedAt'))
	firstChargedAt: Date | null = null;

	@Property(nullableTimestampColumn('detachedAt'))
	detachedAt: Date | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
