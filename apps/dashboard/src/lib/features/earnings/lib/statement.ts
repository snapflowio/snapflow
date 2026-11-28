/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { HostPayout } from '@snapflow/api-client';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';
import { formatMicroUsdAmount } from '#lib/utils/usd.ts';

const MONTHS_PER_YEAR = 12;
const MONTH_DIGITS = 2;
const LAST_MILLISECOND = 1;
const CSV_LINE_SEPARATOR = '\r\n';
const CSV_FIELD_SEPARATOR = ',';
const CSV_QUOTE = '"';
const CSV_NEEDS_QUOTES = /[",\r\n]/;
const PAYOUT_ROW = 'Payout';
const CLAIM_ROW = 'Earning';
const UNKNOWN_MACHINE = 'Retired key';

const CSV_HEADER = [
	'Type',
	'Date (UTC)',
	'Machine',
	'Channel',
	'Amount (USDC)',
	'Network fee (USDC)',
	'You received (USDC)',
	'Payout wallet',
	'Transaction',
] as const;

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC',
});

export interface StatementMonth {
	year: number;
	month: number;
}

export function currentStatementMonth(now: Date): StatementMonth {
	return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

export function shiftStatementMonth(
	value: StatementMonth,
	offset: number
): StatementMonth {
	const index = value.year * MONTHS_PER_YEAR + value.month + offset;
	return {
		year: Math.floor(index / MONTHS_PER_YEAR),
		month: index % MONTHS_PER_YEAR,
	};
}

export function compareStatementMonths(
	left: StatementMonth,
	right: StatementMonth
): number {
	return (
		left.year * MONTHS_PER_YEAR +
		left.month -
		(right.year * MONTHS_PER_YEAR + right.month)
	);
}

export function statementMonthLabel(value: StatementMonth): string {
	return MONTH_LABEL_FORMAT.format(
		new Date(Date.UTC(value.year, value.month))
	).toUpperCase();
}

export function statementMonthRange(value: StatementMonth): {
	from: string;
	to: string;
} {
	const start = Date.UTC(value.year, value.month);
	const next = Date.UTC(value.year, value.month + 1);
	return {
		from: new Date(start).toISOString(),
		to: new Date(next - LAST_MILLISECOND).toISOString(),
	};
}

export function statementFilename(value: StatementMonth): string {
	const month = String(value.month + 1).padStart(MONTH_DIGITS, '0');
	return `snapflow-earnings-${value.year}-${month}.csv`;
}

function csvField(value: string): string {
	return CSV_NEEDS_QUOTES.test(value)
		? `${CSV_QUOTE}${value.replaceAll(CSV_QUOTE, CSV_QUOTE + CSV_QUOTE)}${CSV_QUOTE}`
		: value;
}

function csvLine(fields: readonly string[]): string {
	return fields.map(csvField).join(CSV_FIELD_SEPARATOR);
}

function payoutLines(payout: HostPayout): string[] {
	const machine = payout.machineName ?? UNKNOWN_MACHINE;
	return [
		csvLine([
			PAYOUT_ROW,
			payout.paidAt,
			machine,
			'',
			formatMicroUsdAmount(payout.grossMicroUsd),
			formatMicroUsdAmount(payout.feeMicroUsd),
			formatMicroUsdAmount(payout.netMicroUsd),
			payout.payoutAddress,
			payout.transactionHash,
		]),
		...payout.claims.map((claim) =>
			csvLine([
				CLAIM_ROW,
				claim.claimedAt,
				machine,
				claim.channelId,
				formatMicroUsdAmount(claim.amountMicroUsd),
				'',
				'',
				'',
				claim.transactionHash,
			])
		),
	];
}

export function statementCsv(payouts: readonly HostPayout[]): string {
	return [csvLine(CSV_HEADER), ...payouts.flatMap(payoutLines)].join(
		CSV_LINE_SEPARATOR
	);
}
