/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { TriggerDef } from '@mikro-orm/core';
import { BillingLedgerSide } from '../constants/billing.constants';

export const BILLING_LEDGER_IMMUTABLE_TRIGGER = {
	name: 'billing_ledger_immutable',
	timing: 'before',
	events: ['update', 'delete'],
	body: `
		raise exception 'Posted billing ledger records are immutable.'
			using errcode = 'integrity_constraint_violation';
	`,
} as const satisfies TriggerDef;

const BALANCE_GUARD_FUNCTION = 'billing_ledger_balance_guard_fn';

export function billingLedgerBalancedTrigger(
	table: 'billing_ledger_transaction' | 'billing_ledger_entry'
) {
	return {
		name: `${table}_balanced`,
		timing: 'after',
		events: ['insert'],
		expression: `
create or replace function "${BALANCE_GUARD_FUNCTION}"() returns trigger as $$
declare
	ledger_transaction_id uuid;
	entry_count bigint;
	debit_total numeric;
	credit_total numeric;
begin
	if TG_TABLE_NAME = 'billing_ledger_transaction' then
		ledger_transaction_id := NEW.id;
	else
		ledger_transaction_id := NEW."transactionId";
	end if;
	select count(*),
		coalesce(sum(entry.amount) filter (where entry.side = '${BillingLedgerSide.DEBIT}'), 0),
		coalesce(sum(entry.amount) filter (where entry.side = '${BillingLedgerSide.CREDIT}'), 0)
	into entry_count, debit_total, credit_total
	from "billing_ledger_entry" entry
	where entry."transactionId" = ledger_transaction_id;
	if entry_count < 2 or debit_total <> credit_total then
		raise exception 'Billing ledger transaction % is incomplete or unbalanced.', ledger_transaction_id
			using errcode = 'check_violation';
	end if;
	return null;
end; $$ language plpgsql;
create constraint trigger "${table}_balanced" after insert on "${table}"
	deferrable initially deferred for each row execute function "${BALANCE_GUARD_FUNCTION}"();`,
	} as const satisfies TriggerDef;
}
