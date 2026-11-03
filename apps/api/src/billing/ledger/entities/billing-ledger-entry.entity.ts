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
	Trigger,
} from '@mikro-orm/decorators/legacy';
import {
	BillingLedgerSide,
	type BillingLedgerSide as LedgerSide,
} from '../constants/billing.constants';
import {
	BILLING_LEDGER_IMMUTABLE_TRIGGER,
	billingLedgerBalancedTrigger,
} from './billing-ledger.triggers';
import { BillingLedgerAccount } from './billing-ledger-account.entity';
import { BillingLedgerTransaction } from './billing-ledger-transaction.entity';

const billingLedgerSides = Object.values(BillingLedgerSide)
	.map((side) => `'${side}'`)
	.join(', ');

@Entity({ tableName: 'billing_ledger_entry' })
@Trigger(BILLING_LEDGER_IMMUTABLE_TRIGGER)
@Trigger(billingLedgerBalancedTrigger('billing_ledger_entry'))
@Index({
	name: 'IDX_billing_ledger_entry_transaction',
	expression:
		'create unique index "IDX_billing_ledger_entry_transaction" on "billing_ledger_entry" ("transactionId", "entryNumber")',
})
@Index({
	name: 'IDX_billing_ledger_entry_account',
	properties: ['accountId', 'createdAt'],
})
@Check({
	name: 'CHK_billing_ledger_entry_number',
	expression: '"entryNumber" >= 0',
})
@Check({
	name: 'CHK_billing_ledger_entry_side',
	expression: `"side" in (${billingLedgerSides})`,
})
@Check({
	name: 'CHK_billing_ledger_entry_amount',
	expression: 'amount > 0',
})
export class BillingLedgerEntry {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => BillingLedgerTransaction,
		mapToPk: true,
		joinColumn: 'transactionId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_billing_ledger_entry_transaction',
	})
	transactionId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'entryNumber',
	})
	entryNumber: number;

	@ManyToOne({
		entity: () => BillingLedgerAccount,
		mapToPk: true,
		joinColumn: 'accountId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_billing_ledger_entry_account',
	})
	accountId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	side: LedgerSide;

	@Property({
		type: new DecimalType('string'),
		columnType: 'numeric(40,0)',
	})
	amount: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
