/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Document,
	Link,
	Page,
	renderToBuffer,
	StyleSheet,
	Text,
	View,
} from '@react-pdf/renderer';
import {
	PDF_BOLD_WEIGHT as BOLD_WEIGHT,
	PDF_FONT_FAMILY as FONT_FAMILY,
	PDF_MONO_FONT_FAMILY as MONO_FONT_FAMILY,
} from '../../common/pdf/pdf-fonts';
import { SnapflowLogo } from '../../common/pdf/snapflow-logo';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { RECEIPT_PDF_SANDBOX_ROW_LIMIT } from '../constants/billing-receipt.constants';
import type { BillingReceiptDto } from '../dto/billing-receipt.dto';
import type { BillingReceiptIssuer } from '../types/billing-receipt.types';
import {
	RECEIPT_BALANCE_LABEL,
	RECEIPT_CHARGE_LABEL,
	RECEIPT_PAYMENT_LABEL,
	receiptOtherAdjustments,
	receiptUsd,
} from '../utils/reporting/billing-receipt.util';

const DISPLAY_LOCALE = 'en-GB';
const DISPLAY_TIME_ZONE = 'UTC';
const LANGUAGE = 'en';
const PAGE_SIZE = 'A4';
const HASH_PREFIX_LENGTH = 10;
const HASH_SUFFIX_LENGTH = 8;
const ELLIPSIS = '…';
const EXPLORER_TRANSACTION_PATH = '/tx/';
const LAST_MILLISECOND = 1;
const LOGO_SIZE = 40;

const COLOR = {
	TEXT: '#111111',
	MUTED: '#6b6b6b',
	RULE: '#d9d9d9',
	PANEL: '#f5f5f5',
} as const;

const RECEIPT_COPY = {
	TITLE: 'Receipt',
	STATUS: 'Paid from escrow',
	BILL_TO: 'Bill to',
	NUMBER: 'Receipt number',
	ISSUED: 'Issue date',
	PERIOD: 'Service period (UTC)',
	CHARGES: 'Charges',
	AMOUNT: 'Amount (USD)',
	DESCRIPTION: 'Description',
	ESCROW: 'Escrow balance',
	PAYMENTS: 'Payments',
	DATE: 'Date',
	TRANSACTION: 'Transaction',
	SANDBOXES: 'Usage by sandbox',
	SANDBOX: 'Sandbox',
	OTHER_SANDBOXES: 'Other sandboxes',
	TAX_ID: 'Tax ID',
	CURRENCY_NOTE:
		'Amounts are in US dollars, settled in USDC (1 USDC = 1 USD). The CSV export carries the exact amounts.',
	MARKETPLACE_NOTE:
		'Snapflow runs a marketplace: independent hosts supply the compute your sandboxes ran on, and Snapflow collects their charges and its platform fee from your escrow. This receipt confirms payment; it is not a tax invoice.',
	PAGE: 'Page',
	OF: 'of',
} as const;

const styles = StyleSheet.create({
	page: {
		fontFamily: FONT_FAMILY,
		fontSize: 9,
		color: COLOR.TEXT,
		paddingTop: 40,
		paddingBottom: 64,
		paddingHorizontal: 44,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 28,
	},
	brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	title: { fontSize: 20, fontWeight: BOLD_WEIGHT },
	status: { color: COLOR.MUTED, marginTop: 4 },
	issuer: { alignItems: 'flex-end', maxWidth: 240 },
	issuerName: { fontWeight: BOLD_WEIGHT, marginBottom: 2 },
	muted: { color: COLOR.MUTED },
	details: { flexDirection: 'row', marginBottom: 24 },
	detailsColumn: { flex: 1 },
	label: { color: COLOR.MUTED, marginBottom: 2 },
	detailValue: { marginBottom: 8 },
	sectionTitle: {
		fontWeight: BOLD_WEIGHT,
		marginTop: 18,
		marginBottom: 6,
	},
	row: {
		flexDirection: 'row',
		paddingVertical: 4,
		borderBottomWidth: 0.5,
		borderBottomColor: COLOR.RULE,
	},
	headerRow: {
		flexDirection: 'row',
		paddingVertical: 4,
		borderBottomWidth: 0.75,
		borderBottomColor: COLOR.TEXT,
		color: COLOR.MUTED,
	},
	totalRow: {
		flexDirection: 'row',
		paddingVertical: 6,
		backgroundColor: COLOR.PANEL,
		fontWeight: BOLD_WEIGHT,
	},
	cell: { flex: 1, paddingHorizontal: 4 },
	wideCell: { flex: 3, paddingHorizontal: 4 },
	amountCell: { width: 90, paddingHorizontal: 4, textAlign: 'right' },
	mono: { fontFamily: MONO_FONT_FAMILY, fontSize: 8 },
	link: { color: COLOR.TEXT, textDecoration: 'none' },
	notes: { marginTop: 24, color: COLOR.MUTED },
	note: { marginBottom: 6 },
	footer: {
		position: 'absolute',
		bottom: 28,
		left: 44,
		right: 44,
		flexDirection: 'row',
		justifyContent: 'space-between',
		color: COLOR.MUTED,
		fontSize: 8,
	},
});

const dateFormat = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	dateStyle: 'long',
	timeZone: DISPLAY_TIME_ZONE,
});
const countryNames = new Intl.DisplayNames([DISPLAY_LOCALE], {
	type: 'region',
});

function formatDate(value: Date | string): string {
	return dateFormat.format(new Date(value));
}

function shortHash(hash: string): string {
	return `${hash.slice(0, HASH_PREFIX_LENGTH)}${ELLIPSIS}${hash.slice(-HASH_SUFFIX_LENGTH)}`;
}

function billToLines(receipt: BillingReceiptDto): string[] {
	const { billTo } = receipt;
	const locality = [billTo.postalCode, billTo.city, billTo.region]
		.filter(Boolean)
		.join(' ');
	return [
		billTo.legalName,
		billTo.addressLine1,
		billTo.addressLine2,
		locality,
		countryNames.of(billTo.country) ?? billTo.country,
		billTo.taxId && `${RECEIPT_COPY.TAX_ID}: ${billTo.taxId}`,
	].filter((line): line is string => Boolean(line));
}

function AmountRow({ label, microUsd }: { label: string; microUsd: string }) {
	return (
		<View style={styles.row} wrap={false}>
			<Text style={styles.wideCell}>{label}</Text>
			<Text style={styles.amountCell}>{receiptUsd(microUsd)}</Text>
		</View>
	);
}

function TotalRow({ label, microUsd }: { label: string; microUsd: string }) {
	return (
		<View style={styles.totalRow} wrap={false}>
			<Text style={styles.wideCell}>{label}</Text>
			<Text style={styles.amountCell}>{receiptUsd(microUsd)}</Text>
		</View>
	);
}

function Header({ issuer }: { issuer: BillingReceiptIssuer }) {
	return (
		<View style={styles.header}>
			<View style={styles.brand}>
				<SnapflowLogo size={LOGO_SIZE} />
				<View>
					<Text style={styles.title}>{RECEIPT_COPY.TITLE}</Text>
					<Text style={styles.status}>{RECEIPT_COPY.STATUS}</Text>
				</View>
			</View>
			<View style={styles.issuer}>
				<Text style={styles.issuerName}>{issuer.name}</Text>
				<Text style={styles.muted}>{issuer.address}</Text>
				<Text style={styles.muted}>{issuer.email}</Text>
				{issuer.taxId && (
					<Text style={styles.muted}>
						{RECEIPT_COPY.TAX_ID}: {issuer.taxId}
					</Text>
				)}
			</View>
		</View>
	);
}

function Details({ receipt }: { receipt: BillingReceiptDto }) {
	const lastDay = new Date(
		new Date(receipt.periodEnd).getTime() - LAST_MILLISECOND
	);
	return (
		<View style={styles.details}>
			<View style={styles.detailsColumn}>
				<Text style={styles.label}>{RECEIPT_COPY.BILL_TO}</Text>
				{billToLines(receipt).map((line) => (
					<Text key={line}>{line}</Text>
				))}
			</View>
			<View style={styles.detailsColumn}>
				<Text style={styles.label}>{RECEIPT_COPY.NUMBER}</Text>
				<Text style={styles.detailValue}>{receipt.number}</Text>
				<Text style={styles.label}>{RECEIPT_COPY.ISSUED}</Text>
				<Text style={styles.detailValue}>{formatDate(receipt.issuedAt)}</Text>
				<Text style={styles.label}>{RECEIPT_COPY.PERIOD}</Text>
				<Text style={styles.detailValue}>
					{formatDate(receipt.periodStart)} – {formatDate(lastDay)}
				</Text>
			</View>
		</View>
	);
}

function Charges({ receipt }: { receipt: BillingReceiptDto }) {
	return (
		<View>
			<Text style={styles.sectionTitle}>{RECEIPT_COPY.CHARGES}</Text>
			<View style={styles.headerRow}>
				<Text style={styles.wideCell}>{RECEIPT_COPY.DESCRIPTION}</Text>
				<Text style={styles.amountCell}>{RECEIPT_COPY.AMOUNT}</Text>
			</View>
			<AmountRow
				label={RECEIPT_CHARGE_LABEL.HOST_COMPUTE}
				microUsd={receipt.hostComputeMicroUsd}
			/>
			<AmountRow
				label={RECEIPT_CHARGE_LABEL.SNAPFLOW_FEE}
				microUsd={receipt.snapflowFeeMicroUsd}
			/>
			<AmountRow
				label={RECEIPT_CHARGE_LABEL.STORAGE}
				microUsd={receipt.storageMicroUsd}
			/>
			<TotalRow
				label={RECEIPT_CHARGE_LABEL.TOTAL}
				microUsd={receipt.totalMicroUsd}
			/>
		</View>
	);
}

function EscrowBalance({ receipt }: { receipt: BillingReceiptDto }) {
	const adjustments = receiptOtherAdjustments(receipt);
	return (
		<View wrap={false}>
			<Text style={styles.sectionTitle}>
				{RECEIPT_COPY.ESCROW} ({receipt.networkName})
			</Text>
			<AmountRow
				label={RECEIPT_BALANCE_LABEL.OPENING}
				microUsd={receipt.openingCreditMicroUsd}
			/>
			<AmountRow
				label={RECEIPT_BALANCE_LABEL.DEPOSITS}
				microUsd={receipt.depositsMicroUsd}
			/>
			<AmountRow
				label={RECEIPT_BALANCE_LABEL.WITHDRAWALS}
				microUsd={MicroUsd.parse(receipt.withdrawalsMicroUsd)
					.negate()
					.toString()}
			/>
			<AmountRow
				label={RECEIPT_BALANCE_LABEL.CHARGES}
				microUsd={MicroUsd.parse(receipt.totalMicroUsd).negate().toString()}
			/>
			{!adjustments.isZero() && (
				<AmountRow
					label={RECEIPT_BALANCE_LABEL.ADJUSTMENTS}
					microUsd={adjustments.toString()}
				/>
			)}
			<TotalRow
				label={RECEIPT_BALANCE_LABEL.CLOSING}
				microUsd={receipt.closingCreditMicroUsd}
			/>
		</View>
	);
}

function TransactionCell({
	hash,
	explorerUrl,
}: {
	hash: string | null;
	explorerUrl: string | null;
}) {
	if (!hash) return <Text style={styles.wideCell} />;
	const text = <Text style={styles.mono}>{shortHash(hash)}</Text>;
	return (
		<View style={styles.wideCell}>
			{explorerUrl ? (
				<Link
					src={`${explorerUrl}${EXPLORER_TRANSACTION_PATH}${hash}`}
					style={styles.link}
				>
					{text}
				</Link>
			) : (
				text
			)}
		</View>
	);
}

function Payments({ receipt }: { receipt: BillingReceiptDto }) {
	if (receipt.payments.length === 0) return null;
	return (
		<View>
			<Text style={styles.sectionTitle}>{RECEIPT_COPY.PAYMENTS}</Text>
			<View style={styles.headerRow} fixed>
				<Text style={styles.cell}>{RECEIPT_COPY.DATE}</Text>
				<Text style={styles.cell}>{RECEIPT_COPY.DESCRIPTION}</Text>
				<Text style={styles.wideCell}>{RECEIPT_COPY.TRANSACTION}</Text>
				<Text style={styles.amountCell}>{RECEIPT_COPY.AMOUNT}</Text>
			</View>
			{receipt.payments.map((payment) => (
				<View
					key={`${payment.occurredAt}-${payment.transactionHash}`}
					style={styles.row}
					wrap={false}
				>
					<Text style={styles.cell}>{formatDate(payment.occurredAt)}</Text>
					<Text style={styles.cell}>{RECEIPT_PAYMENT_LABEL[payment.kind]}</Text>
					<TransactionCell
						hash={payment.transactionHash}
						explorerUrl={receipt.explorerUrl}
					/>
					<Text style={styles.amountCell}>
						{receiptUsd(payment.amountMicroUsd)}
					</Text>
				</View>
			))}
		</View>
	);
}

function SandboxUsage({ receipt }: { receipt: BillingReceiptDto }) {
	if (receipt.usageBySandbox.length === 0) return null;
	const shown = receipt.usageBySandbox.slice(0, RECEIPT_PDF_SANDBOX_ROW_LIMIT);
	const hidden = receipt.usageBySandbox.slice(RECEIPT_PDF_SANDBOX_ROW_LIMIT);
	return (
		<View>
			<Text style={styles.sectionTitle}>{RECEIPT_COPY.SANDBOXES}</Text>
			<View style={styles.headerRow} fixed>
				<Text style={styles.wideCell}>{RECEIPT_COPY.SANDBOX}</Text>
				<Text style={styles.amountCell}>{RECEIPT_COPY.AMOUNT}</Text>
			</View>
			{shown.map((usage) => (
				<AmountRow
					key={usage.sandboxId}
					label={usage.sandboxName ?? usage.sandboxId}
					microUsd={usage.amountMicroUsd}
				/>
			))}
			{hidden.length > 0 && (
				<AmountRow
					label={`${RECEIPT_COPY.OTHER_SANDBOXES} (${hidden.length})`}
					microUsd={MicroUsd.sum(
						hidden.map((usage) => MicroUsd.parse(usage.amountMicroUsd))
					).toString()}
				/>
			)}
		</View>
	);
}

function BillingReceiptDocument({
	receipt,
	issuer,
}: {
	receipt: BillingReceiptDto;
	issuer: BillingReceiptIssuer;
}) {
	const issuedAt = new Date(receipt.issuedAt);
	return (
		<Document
			title={`${RECEIPT_COPY.TITLE} ${receipt.number}`}
			author={issuer.name}
			creator={issuer.name}
			producer={issuer.name}
			language={LANGUAGE}
			creationDate={issuedAt}
			modificationDate={issuedAt}
		>
			<Page size={PAGE_SIZE} style={styles.page}>
				<Header issuer={issuer} />
				<Details receipt={receipt} />
				<Charges receipt={receipt} />
				<EscrowBalance receipt={receipt} />
				<Payments receipt={receipt} />
				<SandboxUsage receipt={receipt} />
				<View style={styles.notes} wrap={false}>
					<Text style={styles.note}>{RECEIPT_COPY.CURRENCY_NOTE}</Text>
					<Text style={styles.note}>{RECEIPT_COPY.MARKETPLACE_NOTE}</Text>
				</View>
				<View style={styles.footer} fixed>
					<Text>
						{issuer.name} · {receipt.number}
					</Text>
					<Text
						render={({ pageNumber, totalPages }) =>
							`${RECEIPT_COPY.PAGE} ${pageNumber} ${RECEIPT_COPY.OF} ${totalPages}`
						}
					/>
				</View>
			</Page>
		</Document>
	);
}

export function renderReceiptPdf(
	receipt: BillingReceiptDto,
	issuer: BillingReceiptIssuer
): Promise<Buffer> {
	return renderToBuffer(
		<BillingReceiptDocument receipt={receipt} issuer={issuer} />
	);
}
