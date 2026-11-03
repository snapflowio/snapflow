/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BillingLedgerAccountCode,
	BillingLedgerSourceType,
} from '../../../billing/ledger/constants/billing.constants';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { STATEMENT_MONTH_PATTERN } from '../constants/payments.constants';
import type {
	BillingStatementCustomerDto,
	BillingStatementHostDto,
	BillingStatementSummaryDto,
} from '../dto/billing-statement.dto';
import type {
	StatementSandboxUsageRow,
	StatementTotalRow,
} from '../queries/billing-statement.query';

const MONTH_DIGITS = 2;
const MONTH_PAD = '0';
const MONTH_OFFSET = 1;
const FIRST_DAY_OF_MONTH = 1;

export interface StatementPeriod {
	month: string;
	periodStart: Date;
	periodEnd: Date;
}

export interface CustomerStatementInput {
	totals: readonly StatementTotalRow[];
	openingCreditMicroUsd: MicroUsd;
	usageBySandbox: readonly StatementSandboxUsageRow[];
	taxMicroUsd: MicroUsd;
}

function total(
	rows: readonly StatementTotalRow[],
	accountCode: string,
	sourceTypes: readonly string[]
): MicroUsd {
	return MicroUsd.sum(
		rows
			.filter(
				(row) =>
					row.accountCode === accountCode &&
					sourceTypes.includes(row.sourceType)
			)
			.map((row) => row.amountMicroUsd)
	);
}

function accountTotal(
	rows: readonly StatementTotalRow[],
	accountCode: string
): MicroUsd {
	return MicroUsd.sum(
		rows
			.filter((row) => row.accountCode === accountCode)
			.map((row) => row.amountMicroUsd)
	);
}

export function formatStatementMonth(date: Date): string {
	const month = String(date.getUTCMonth() + MONTH_OFFSET).padStart(
		MONTH_DIGITS,
		MONTH_PAD
	);
	return `${date.getUTCFullYear()}-${month}`;
}

export function monthStart(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), FIRST_DAY_OF_MONTH)
	);
}

function nextMonthStart(start: Date): Date {
	return new Date(
		Date.UTC(
			start.getUTCFullYear(),
			start.getUTCMonth() + MONTH_OFFSET,
			FIRST_DAY_OF_MONTH
		)
	);
}

export function parseStatementMonth(month: string): StatementPeriod | null {
	const match = STATEMENT_MONTH_PATTERN.exec(month);
	if (!match) return null;
	const periodStart = new Date(
		Date.UTC(
			Number(match[1]),
			Number(match[2]) - MONTH_OFFSET,
			FIRST_DAY_OF_MONTH
		)
	);
	return { month, periodStart, periodEnd: nextMonthStart(periodStart) };
}

export function statementSummary(
	period: StatementPeriod,
	now: Date
): BillingStatementSummaryDto {
	return {
		month: period.month,
		periodStart: period.periodStart,
		periodEnd: period.periodEnd,
		open: now < period.periodEnd,
	};
}

export function statementPeriods(
	firstActivity: Date | null,
	now: Date
): StatementPeriod[] {
	const last = monthStart(now);
	const periods: StatementPeriod[] = [];
	for (
		let start = monthStart(
			firstActivity && firstActivity < now ? firstActivity : now
		);
		start <= last;
		start = nextMonthStart(start)
	) {
		periods.push({
			month: formatStatementMonth(start),
			periodStart: start,
			periodEnd: nextMonthStart(start),
		});
	}
	return periods.reverse();
}

export function customerStatement(
	input: CustomerStatementInput
): BillingStatementCustomerDto {
	const credit = BillingLedgerAccountCode.CUSTOMER_CREDIT;
	const rows = input.totals;
	const change = accountTotal(rows, credit);
	return {
		openingCreditMicroUsd: input.openingCreditMicroUsd.toString(),
		closingCreditMicroUsd: input.openingCreditMicroUsd.add(change).toString(),
		topUpsMicroUsd: total(rows, credit, [
			BillingLedgerSourceType.STRIPE_TOP_UP,
		]).toString(),
		adminGrantsMicroUsd: total(rows, credit, [
			BillingLedgerSourceType.ADMIN_CREDIT_GRANT,
		]).toString(),
		usageMicroUsd: total(rows, credit, [BillingLedgerSourceType.LINE_USAGE])
			.absolute()
			.toString(),
		usageBySandbox: input.usageBySandbox.map((row) => ({
			sandboxId: row.sandboxId,
			sandboxName: row.sandboxName ?? undefined,
			amountMicroUsd: row.amountMicroUsd.toString(),
		})),
		disputeFreezesMicroUsd: total(rows, credit, [
			BillingLedgerSourceType.STRIPE_DISPUTE_FREEZE,
		])
			.absolute()
			.toString(),
		disputeReinstatementsMicroUsd: total(rows, credit, [
			BillingLedgerSourceType.STRIPE_DISPUTE_REINSTATEMENT,
		]).toString(),
		forfeitureCreditsMicroUsd: total(rows, credit, [
			BillingLedgerSourceType.EARNINGS_FORFEITURE,
		]).toString(),
		taxMicroUsd: input.taxMicroUsd.toString(),
	};
}

export function hostStatement(
	rows: readonly StatementTotalRow[]
): BillingStatementHostDto {
	const pending = BillingLedgerAccountCode.HOST_EARNINGS_PENDING;
	return {
		earningsMicroUsd: total(rows, pending, [
			BillingLedgerSourceType.LINE_USAGE,
			BillingLedgerSourceType.QUALIFICATION_CREDIT,
		]).toString(),
		forfeitedMicroUsd: total(rows, pending, [
			BillingLedgerSourceType.EARNINGS_FORFEITURE,
		])
			.absolute()
			.toString(),
		maturedMicroUsd: total(
			rows,
			BillingLedgerAccountCode.HOST_EARNINGS_PAYABLE,
			[BillingLedgerSourceType.EARNINGS_MATURITY]
		).toString(),
		paidOutMicroUsd: total(
			rows,
			BillingLedgerAccountCode.HOST_TRANSFERS_PENDING,
			[BillingLedgerSourceType.PAYOUT_TRANSFER]
		)
			.absolute()
			.toString(),
	};
}
