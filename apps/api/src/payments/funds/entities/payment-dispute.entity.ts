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
import {
	BILLING_NUMERIC_PRECISION,
	BILLING_NUMERIC_SCALE,
} from '../../../billing/ledger/constants/billing.constants';
import { sqlValueList } from '../../../infra/database/utils/sql-value-list.util';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import { DisputeState } from '../enums/dispute-state.enum';
import { TopUp } from './top-up.entity';

const nullableTimestampColumn = (fieldName: string) =>
	({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName,
		nullable: true,
	}) as const;

@Entity({ tableName: 'payment_dispute' })
@Unique({
	name: 'UQ_payment_dispute_stripe_dispute',
	properties: ['stripeDisputeId'],
})
@Check({
	name: 'CHK_payment_dispute_amounts',
	expression: '"amountCents" >= 0 and "frozenMicroUsd" >= 0',
})
@Check({
	name: 'CHK_payment_dispute_state',
	expression: `"state" in (${sqlValueList(DisputeState)})`,
})
export class PaymentDispute {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'stripeDisputeId',
	})
	stripeDisputeId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_payment_dispute_organization',
	})
	organizationId: string;

	@ManyToOne({
		entity: () => TopUp,
		mapToPk: true,
		joinColumn: 'topUpId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_payment_dispute_top_up',
	})
	topUpId: string | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'amountCents',
	})
	amountCents: number;

	@Property({
		type: DecimalType,
		columnType: `numeric(${BILLING_NUMERIC_PRECISION.MONEY},${BILLING_NUMERIC_SCALE.MONEY})`,
		runtimeType: 'string',
		fieldName: 'frozenMicroUsd',
		default: 0,
	})
	frozenMicroUsd = '0';

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'state' })
	state: DisputeState;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'reason' })
	reason: string;

	@Property(nullableTimestampColumn('evidenceDueBy'))
	evidenceDueBy: Date | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	@Property(nullableTimestampColumn('closedAt'))
	closedAt: Date | null = null;
}
