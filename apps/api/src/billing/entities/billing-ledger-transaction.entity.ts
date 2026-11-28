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
	PrimaryKey,
	Property,
	Trigger,
} from '@mikro-orm/decorators/legacy';
import {
	BILLING_LEDGER_IMMUTABLE_TRIGGER,
	billingLedgerBalancedTrigger,
} from './billing-ledger.triggers';

@Entity({ tableName: 'billing_ledger_transaction' })
@Trigger(BILLING_LEDGER_IMMUTABLE_TRIGGER)
@Trigger(billingLedgerBalancedTrigger('billing_ledger_transaction'))
@Index({
	name: 'IDX_billing_ledger_transaction_source',
	expression:
		'create unique index "IDX_billing_ledger_transaction_source" on "billing_ledger_transaction" ("sourceType", "sourceReference", "sourceVersion")',
})
@Check({
	name: 'CHK_billing_ledger_transaction_version',
	expression: '"sourceVersion" > 0',
})
export class BillingLedgerTransaction {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sourceType',
	})
	sourceType: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sourceReference',
	})
	sourceReference: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'sourceVersion',
	})
	sourceVersion: number;

	@Property({
		type: 'string',
		columnType: 'varchar(64)',
		fieldName: 'postingHash',
	})
	postingHash: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'descriptionCode',
	})
	descriptionCode: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'effectiveAt',
	})
	effectiveAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'postedAt',
	})
	postedAt: Date;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		defaultRaw: "'{}'",
	})
	metadata: Record<string, unknown>;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
