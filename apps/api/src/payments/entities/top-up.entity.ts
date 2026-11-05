/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Organization } from '../../organization/entities/organization.entity';
import { TopUpKind } from '../enums/top-up-kind.enum';
import { TopUpState } from '../enums/top-up-state.enum';
import { PaymentMethod } from './payment-method.entity';

const nullableVarcharColumn = (fieldName: string) =>
	({
		type: 'string',
		columnType: 'varchar',
		fieldName,
		nullable: true,
	}) as const;

@Entity({ tableName: 'top_up' })
@Unique({
	name: 'UQ_top_up_stripe_checkout_session',
	properties: ['stripeCheckoutSessionId'],
})
@Unique({
	name: 'UQ_top_up_stripe_payment_intent',
	properties: ['stripePaymentIntentId'],
})
@Index({
	name: 'IDX_top_up_organization',
	properties: ['organizationId', 'createdAt'],
})
@Check({
	name: 'CHK_top_up_amounts',
	expression: '"amountCents" > 0 and "taxCents" >= 0',
})
@Check({
	name: 'CHK_top_up_kind',
	expression: `"kind" in (${sqlValueList(TopUpKind)})`,
})
@Check({
	name: 'CHK_top_up_state',
	expression: `"state" in (${sqlValueList(TopUpState)})`,
})
export class TopUp {
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
		foreignKeyName: 'FK_top_up_organization',
	})
	organizationId: string;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'kind' })
	kind: TopUpKind;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'amountCents',
	})
	amountCents: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'taxCents',
		default: 0,
	})
	taxCents = 0;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'state',
		default: TopUpState.CREATED,
	})
	state: TopUpState = TopUpState.CREATED;

	@Property(nullableVarcharColumn('stripeCheckoutSessionId'))
	stripeCheckoutSessionId: string | null = null;

	@Property(nullableVarcharColumn('stripePaymentIntentId'))
	stripePaymentIntentId: string | null = null;

	@ManyToOne({
		entity: () => PaymentMethod,
		mapToPk: true,
		joinColumn: 'paymentMethodId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_top_up_payment_method',
	})
	paymentMethodId: string | null = null;

	@Property(nullableVarcharColumn('failureCode'))
	failureCode: string | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'succeededAt',
		nullable: true,
	})
	succeededAt: Date | null = null;
}
