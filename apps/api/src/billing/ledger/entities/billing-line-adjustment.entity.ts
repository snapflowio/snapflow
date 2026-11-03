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
} from '@mikro-orm/decorators/legacy';
import {
	BILLING_COLUMN_LENGTH,
	BILLING_NUMERIC_PRECISION,
	BILLING_NUMERIC_SCALE,
	BillingAdjustmentKind,
	type BillingAdjustmentKind as BillingAdjustmentKindValue,
} from '../constants/billing.constants';
import { BillingLineItem } from './billing-line-item.entity';

const billingAdjustmentKinds = Object.values(BillingAdjustmentKind)
	.map((value) => `'${value}'`)
	.join(', ');

@Entity({ tableName: 'billing_line_adjustment' })
@Index({
	name: 'IDX_billing_line_adjustment_line',
	properties: ['lineItemId', 'createdAt'],
})
@Index({
	name: 'IDX_billing_line_adjustment_evidence',
	expression:
		'create unique index "IDX_billing_line_adjustment_evidence" on "billing_line_adjustment" ("evidenceDigest")',
})
@Check({
	name: 'CHK_billing_line_adjustment_amount',
	expression: '"amountMicroUsd" > 0',
})
@Check({
	name: 'CHK_billing_line_adjustment_kind',
	expression: `kind in (${billingAdjustmentKinds})`,
})
export class BillingLineAdjustment {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => BillingLineItem,
		mapToPk: true,
		joinColumn: 'lineItemId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'billing_line_adjustment_lineItemId_fkey',
	})
	lineItemId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	kind: BillingAdjustmentKindValue;

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
		fieldName: 'reasonCode',
	})
	reasonCode: string;

	@Property({
		type: 'string',
		columnType: 'text',
	})
	explanation: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'actorId',
	})
	actorId: string;

	@Property({
		type: 'string',
		columnType: `varchar(${BILLING_COLUMN_LENGTH.EVIDENCE_DIGEST})`,
		fieldName: 'evidenceDigest',
	})
	evidenceDigest: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'policyVersion',
	})
	policyVersion: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
	})
	createdAt: Date;
}
