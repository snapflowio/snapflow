/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import {
	Entity,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../organization/entities/organization.entity';
import type {
	BillingReceiptBillTo,
	BillingReceiptContent,
} from '../types/billing-receipt.types';

const MONTH_LENGTH = 7;

const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

@Entity({ tableName: 'billing_receipt' })
@Unique({
	name: 'UQ_billing_receipt_organization_month',
	properties: ['organizationId', 'month'],
})
@Unique({ name: 'UQ_billing_receipt_sequence', properties: ['sequence'] })
export class BillingReceipt {
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
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_billing_receipt_organization',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: `char(${MONTH_LENGTH})`,
		fieldName: 'month',
	})
	month: string;

	@Property({ type: 'integer', columnType: 'integer', fieldName: 'sequence' })
	sequence: number;

	@Property(timestampColumn('issuedAt'))
	issuedAt: Date;

	@Property({ type: 'json', columnType: 'jsonb', fieldName: 'billTo' })
	billTo: BillingReceiptBillTo;

	@Property({ type: 'json', columnType: 'jsonb', fieldName: 'content' })
	content: BillingReceiptContent;

	@Property({
		...timestampColumn('createdAt'),
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
