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
	BILLING_LEDGER_CURRENCY,
	BillingLedgerAccountCode,
	BillingLedgerOwnerKind,
} from '../constants/billing.constants';
import { BILLING_LEDGER_IMMUTABLE_TRIGGER } from './billing-ledger.triggers';

const billingLedgerOwnerKinds = Object.values(BillingLedgerOwnerKind)
	.map((ownerKind) => `'${ownerKind}'`)
	.join(', ');

const billingLedgerAccountCodes = Object.values(BillingLedgerAccountCode)
	.map((accountCode) => `'${accountCode}'`)
	.join(', ');

@Entity({ tableName: 'billing_ledger_account' })
@Trigger(BILLING_LEDGER_IMMUTABLE_TRIGGER)
@Index({
	name: 'IDX_billing_ledger_account_owner',
	expression:
		'create unique index "IDX_billing_ledger_account_owner" on "billing_ledger_account" ("ownerKind", "ownerReference", "accountCode", "currency")',
})
@Check({
	name: 'CHK_billing_ledger_account_currency',
	expression: `"currency" in ('${BILLING_LEDGER_CURRENCY}')`,
})
@Check({
	name: 'CHK_billing_ledger_account_owner',
	expression: `"ownerKind" in (${billingLedgerOwnerKinds})`,
})
@Check({
	name: 'CHK_billing_ledger_account_code',
	expression: `"accountCode" in (${billingLedgerAccountCodes})`,
})
export class BillingLedgerAccount {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'ownerKind',
	})
	ownerKind: BillingLedgerOwnerKind;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'ownerReference',
	})
	ownerReference: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'accountCode',
	})
	accountCode: BillingLedgerAccountCode;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: BILLING_LEDGER_CURRENCY,
	})
	currency: typeof BILLING_LEDGER_CURRENCY;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
