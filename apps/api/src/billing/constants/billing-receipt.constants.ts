/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const BillingReceiptErrorCode = {
	PROFILE_REQUIRED: 'billing_profile_required',
	PROFILE_NOT_FOUND: 'billing_profile_not_found',
	MONTH_OPEN: 'billing_receipt_month_open',
	MONTH_WITHOUT_ACTIVITY: 'billing_receipt_month_without_activity',
	NOT_FOUND: 'billing_receipt_not_found',
	NOT_CONFIGURED: 'billing_receipts_not_configured',
} as const;

export type BillingReceiptErrorCode =
	(typeof BillingReceiptErrorCode)[keyof typeof BillingReceiptErrorCode];

export const BILLING_PROFILE_LIMITS = {
	LEGAL_NAME: 200,
	ADDRESS_LINE: 200,
	CITY: 100,
	REGION: 100,
	POSTAL_CODE: 32,
	TAX_ID: 64,
} as const;

export const RECEIPT_NUMBER = {
	PREFIX: 'SF',
	SEQUENCE_DIGITS: 6,
	SEPARATOR: '-',
} as const;

export const RECEIPT_ISSUE_LOCK_KEY = 72_430_118_001n;

export const RECEIPT_PDF_SANDBOX_ROW_LIMIT = 200;

export const RECEIPT_USD_DECIMALS = 2;

export const RECEIPT_TRANSACTION_HASH_METADATA_KEY = 'transactionHash';

export const ReceiptDocumentFormat = {
	PDF: 'pdf',
	CSV: 'csv',
} as const;

export type ReceiptDocumentFormat =
	(typeof ReceiptDocumentFormat)[keyof typeof ReceiptDocumentFormat];

export const RECEIPT_FILENAME_PREFIX = 'snapflow-receipt';

export const RECEIPT_DOCUMENT_CONTENT_TYPE = {
	[ReceiptDocumentFormat.PDF]: 'application/pdf',
	[ReceiptDocumentFormat.CSV]: 'text/csv; charset=utf-8',
} as const satisfies Record<ReceiptDocumentFormat, string>;

export const ReceiptPaymentKind = {
	DEPOSIT: 'deposit',
	WITHDRAWAL: 'withdrawal',
} as const;

export type ReceiptPaymentKind =
	(typeof ReceiptPaymentKind)[keyof typeof ReceiptPaymentKind];
