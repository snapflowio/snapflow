/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { CsvRow } from '../../../common/utils/csv.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { BillingLedgerSourceType } from '../../constants/billing.constants';
import {
	RECEIPT_NUMBER,
	RECEIPT_USD_DECIMALS,
	ReceiptPaymentKind,
} from '../../constants/billing-receipt.constants';
import type {
	BillingReceiptDto,
	BillingReceiptSummaryDto,
} from '../../dto/billing-receipt.dto';
import type { BillingStatementDto } from '../../dto/billing-statement.dto';
import type { BillingProfile } from '../../entities/billing-profile.entity';
import type { BillingReceipt } from '../../entities/billing-receipt.entity';
import type { StatementEscrowPaymentRow } from '../../queries/billing-statement.query';
import type {
	BillingReceiptBillTo,
	BillingReceiptContent,
} from '../../types/billing-receipt.types';
import { parseStatementMonth } from './billing-statement.util';

const SEQUENCE_PAD = '0';
const MICRO_USD_PER_CENT = 10_000n;
const HALF_CENT_MICRO_USD = MICRO_USD_PER_CENT / 2n;
const CENTS_PER_USD = 100n;
const NEGATIVE_SIGN = '-';
const DECIMAL_POINT = '.';
const GROUPING_LOCALE = 'en-US';

const RECEIPT_CSV_COLUMN = {
	RECEIPT: 'Receipt',
	SECTION: 'Section',
	DESCRIPTION: 'Description',
	REFERENCE: 'Reference',
	AMOUNT: 'Amount (USD)',
} as const;

export const RECEIPT_CHARGE_LABEL = {
	HOST_COMPUTE: 'Compute from independent hosts',
	SNAPFLOW_FEE: 'Snapflow platform fee',
	STORAGE: 'Snapflow storage',
	TOTAL: 'Total charged',
} as const;

export const RECEIPT_BALANCE_LABEL = {
	OPENING: 'Escrow balance at the start of the month',
	DEPOSITS: 'Deposits',
	WITHDRAWALS: 'Withdrawals',
	CHARGES: 'Charges',
	ADJUSTMENTS: 'Other adjustments',
	CLOSING: 'Escrow balance at the end of the month',
} as const;

export const RECEIPT_PAYMENT_LABEL = {
	[ReceiptPaymentKind.DEPOSIT]: 'Deposit',
	[ReceiptPaymentKind.WITHDRAWAL]: 'Withdrawal',
} as const satisfies Record<ReceiptPaymentKind, string>;

const RECEIPT_SECTION = {
	CHARGE: 'Charge',
	TOTAL: 'Total',
	BALANCE: 'Escrow balance',
	PAYMENT: 'Payment',
	SANDBOX: 'Sandbox usage',
} as const;

interface ReceiptNetwork {
	name: string;
	explorerUrl: string | null;
}

function receiptNumber(sequence: number, issuedAt: Date): string {
	return [
		RECEIPT_NUMBER.PREFIX,
		issuedAt.getUTCFullYear(),
		String(sequence).padStart(RECEIPT_NUMBER.SEQUENCE_DIGITS, SEQUENCE_PAD),
	].join(RECEIPT_NUMBER.SEPARATOR);
}

export function receiptBillTo(profile: BillingProfile): BillingReceiptBillTo {
	return {
		legalName: profile.legalName,
		addressLine1: profile.addressLine1,
		addressLine2: profile.addressLine2,
		city: profile.city,
		region: profile.region,
		postalCode: profile.postalCode,
		country: profile.country,
		taxId: profile.taxId,
	};
}

function paymentKind(sourceType: string): ReceiptPaymentKind {
	return sourceType === BillingLedgerSourceType.ESCROW_DEPOSIT
		? ReceiptPaymentKind.DEPOSIT
		: ReceiptPaymentKind.WITHDRAWAL;
}

export function receiptContent(
	statement: BillingStatementDto,
	payments: readonly StatementEscrowPaymentRow[],
	network: ReceiptNetwork
): BillingReceiptContent {
	const { customer } = statement;
	return {
		hostComputeMicroUsd: customer.hostComputeMicroUsd,
		snapflowFeeMicroUsd: customer.snapflowFeeMicroUsd,
		storageMicroUsd: customer.storageMicroUsd,
		totalMicroUsd: MicroUsd.parse(customer.usageMicroUsd)
			.add(MicroUsd.parse(customer.storageMicroUsd))
			.toString(),
		openingCreditMicroUsd: customer.openingCreditMicroUsd,
		depositsMicroUsd: customer.depositsMicroUsd,
		withdrawalsMicroUsd: customer.withdrawalsMicroUsd,
		closingCreditMicroUsd: customer.closingCreditMicroUsd,
		usageBySandbox: customer.usageBySandbox,
		payments: payments.map((payment) => ({
			kind: paymentKind(payment.sourceType),
			occurredAt: payment.effectiveAt.toISOString(),
			amountMicroUsd: payment.amountMicroUsd.absolute().toString(),
			transactionHash: payment.transactionHash,
		})),
		networkName: network.name,
		explorerUrl: network.explorerUrl,
	};
}

export function receiptSummary(
	receipt: BillingReceipt
): BillingReceiptSummaryDto {
	const period = parseStatementMonth(receipt.month);
	if (!period) {
		throw new Error(`Receipt ${receipt.id} has an invalid month`);
	}
	return {
		id: receipt.id,
		number: receiptNumber(receipt.sequence, receipt.issuedAt),
		month: receipt.month,
		periodStart: period.periodStart,
		periodEnd: period.periodEnd,
		issuedAt: receipt.issuedAt,
		totalMicroUsd: receipt.content.totalMicroUsd,
	};
}

export function receiptDto(receipt: BillingReceipt): BillingReceiptDto {
	return {
		...receiptSummary(receipt),
		...receipt.content,
		billTo: receipt.billTo,
	};
}

export function receiptOtherAdjustments(receipt: BillingReceiptDto): MicroUsd {
	return MicroUsd.parse(receipt.closingCreditMicroUsd)
		.subtract(MicroUsd.parse(receipt.openingCreditMicroUsd))
		.subtract(MicroUsd.parse(receipt.depositsMicroUsd))
		.add(MicroUsd.parse(receipt.withdrawalsMicroUsd))
		.add(MicroUsd.parse(receipt.totalMicroUsd));
}

export function receiptUsd(microUsd: string): string {
	const amount = MicroUsd.parse(microUsd).toBigInt();
	const magnitude = amount < 0n ? -amount : amount;
	const cents = (magnitude + HALF_CENT_MICRO_USD) / MICRO_USD_PER_CENT;
	const fraction = (cents % CENTS_PER_USD)
		.toString()
		.padStart(RECEIPT_USD_DECIMALS, SEQUENCE_PAD);
	const whole = (cents / CENTS_PER_USD).toLocaleString(GROUPING_LOCALE);
	const sign = amount < 0n && cents > 0n ? NEGATIVE_SIGN : '';
	return `${sign}${whole}${DECIMAL_POINT}${fraction}`;
}

function csvRow(
	receipt: BillingReceiptDto,
	section: string,
	description: string,
	reference: string,
	microUsd: string
): CsvRow {
	return {
		[RECEIPT_CSV_COLUMN.RECEIPT]: receipt.number,
		[RECEIPT_CSV_COLUMN.SECTION]: section,
		[RECEIPT_CSV_COLUMN.DESCRIPTION]: description,
		[RECEIPT_CSV_COLUMN.REFERENCE]: reference,
		[RECEIPT_CSV_COLUMN.AMOUNT]: MicroUsd.parse(microUsd).toUsd(),
	};
}

export function receiptCsvRows(receipt: BillingReceiptDto): CsvRow[] {
	const row = (
		section: string,
		description: string,
		reference: string,
		microUsd: string
	) => csvRow(receipt, section, description, reference, microUsd);
	return [
		row(
			RECEIPT_SECTION.CHARGE,
			RECEIPT_CHARGE_LABEL.HOST_COMPUTE,
			'',
			receipt.hostComputeMicroUsd
		),
		row(
			RECEIPT_SECTION.CHARGE,
			RECEIPT_CHARGE_LABEL.SNAPFLOW_FEE,
			'',
			receipt.snapflowFeeMicroUsd
		),
		row(
			RECEIPT_SECTION.CHARGE,
			RECEIPT_CHARGE_LABEL.STORAGE,
			'',
			receipt.storageMicroUsd
		),
		row(
			RECEIPT_SECTION.TOTAL,
			RECEIPT_CHARGE_LABEL.TOTAL,
			'',
			receipt.totalMicroUsd
		),
		row(
			RECEIPT_SECTION.BALANCE,
			RECEIPT_BALANCE_LABEL.OPENING,
			'',
			receipt.openingCreditMicroUsd
		),
		row(
			RECEIPT_SECTION.BALANCE,
			RECEIPT_BALANCE_LABEL.CLOSING,
			'',
			receipt.closingCreditMicroUsd
		),
		...receipt.payments.map((payment) =>
			row(
				RECEIPT_SECTION.PAYMENT,
				`${RECEIPT_PAYMENT_LABEL[payment.kind]} ${payment.occurredAt}`,
				payment.transactionHash ?? '',
				payment.amountMicroUsd
			)
		),
		...receipt.usageBySandbox.map((usage) =>
			row(
				RECEIPT_SECTION.SANDBOX,
				usage.sandboxName ?? usage.sandboxId,
				usage.sandboxId,
				usage.amountMicroUsd
			)
		),
	];
}
