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
	Unique,
} from '@mikro-orm/decorators/legacy';
import {
	BILLING_NUMERIC_PRECISION,
	BILLING_NUMERIC_SCALE,
} from '../../billing/constants/billing.constants';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Organization } from '../../organization/entities/organization.entity';
import { PayoutState } from '../enums/payout-state.enum';
import { PayoutBatch } from './payout-batch.entity';

@Entity({ tableName: 'payout' })
@Index({
	name: 'IDX_payout_organization',
	properties: ['organizationId', 'createdAt'],
})
@Unique({
	name: 'UQ_payout_pending',
	properties: ['organizationId'],
	where: `"state" = '${PayoutState.PENDING}'`,
})
@Unique({
	name: 'UQ_payout_stripe_transfer',
	properties: ['stripeTransferId'],
})
@Check({
	name: 'CHK_payout_amounts',
	expression: '"amountCents" > 0 and "amountMicroUsd" > 0',
})
@Check({
	name: 'CHK_payout_state',
	expression: `"state" in (${sqlValueList(PayoutState)})`,
})
export class Payout {
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
		foreignKeyName: 'FK_payout_organization',
	})
	organizationId: string;

	@ManyToOne({
		entity: () => PayoutBatch,
		mapToPk: true,
		joinColumn: 'batchId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_payout_batch',
	})
	batchId: string;

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
		fieldName: 'amountMicroUsd',
	})
	amountMicroUsd: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'state',
		default: PayoutState.PENDING,
	})
	state: PayoutState = PayoutState.PENDING;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'stripeTransferId',
		nullable: true,
	})
	stripeTransferId: string | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'failureReason',
		nullable: true,
	})
	failureReason: string | null = null;

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
		fieldName: 'transferredAt',
		nullable: true,
	})
	transferredAt: Date | null = null;
}
