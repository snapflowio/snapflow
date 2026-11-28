/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SandboxBillingState = {
	PENDING: 'pending',
	ACTIVE: 'active',
} as const;

export type SandboxBillingState =
	(typeof SandboxBillingState)[keyof typeof SandboxBillingState];

export const BillingEvidenceStatus = {
	PENDING: 'pending',
	CORROBORATED: 'corroborated',
} as const;

export type BillingEvidenceStatus =
	(typeof BillingEvidenceStatus)[keyof typeof BillingEvidenceStatus];

export const BillingAdjustmentKind = {
	CREDIT: 'credit',
	DEBIT: 'debit',
} as const;

export type BillingAdjustmentKind =
	(typeof BillingAdjustmentKind)[keyof typeof BillingAdjustmentKind];

export const BillingBeneficiaryKind = {
	HOST_ORGANIZATION: 'host_organization',
	PLATFORM: 'platform',
} as const;

export type BillingBeneficiaryKind =
	(typeof BillingBeneficiaryKind)[keyof typeof BillingBeneficiaryKind];

export const AccountFundingState = {
	HEALTHY: 'healthy',
	WARNING: 'warning',
	RESTRICTED: 'restricted',
} as const;

export type AccountFundingState =
	(typeof AccountFundingState)[keyof typeof AccountFundingState];

export const BillingAdmissionBlocker = {
	FUNDING_REQUIRED: 'funding_required',
	FUNDING_EXHAUSTED: 'funding_exhausted',
	MONTHLY_BUDGET_EXHAUSTED: 'monthly_budget_exhausted',
	AUTOMATIC_PAYMENTS_REQUIRED: 'automatic_payments_required',
} as const;

export type BillingAdmissionBlocker =
	(typeof BillingAdmissionBlocker)[keyof typeof BillingAdmissionBlocker];

export const BillingBudgetMode = {
	ALERT: 'alert',
	BLOCK_NEW: 'block_new',
} as const;

export type BillingBudgetMode =
	(typeof BillingBudgetMode)[keyof typeof BillingBudgetMode];

export const DEFAULT_BUDGET_MODE = BillingBudgetMode.BLOCK_NEW;

export const BillingForecastMethod = {
	CURRENT_RUN_RATE: 'current_run_rate',
} as const;

export type BillingForecastMethod =
	(typeof BillingForecastMethod)[keyof typeof BillingForecastMethod];

export const BillingForecastConfidence = {
	LIMITED: 'limited',
	DEVELOPING: 'developing',
	MATURE: 'mature',
} as const;

export type BillingForecastConfidence =
	(typeof BillingForecastConfidence)[keyof typeof BillingForecastConfidence];

export const BillingExportFormat = {
	CSV: 'csv',
	JSON: 'json',
} as const;

export type BillingExportFormat =
	(typeof BillingExportFormat)[keyof typeof BillingExportFormat];

export const BillingLedgerSide = {
	DEBIT: 'debit',
	CREDIT: 'credit',
} as const;

export type BillingLedgerSide =
	(typeof BillingLedgerSide)[keyof typeof BillingLedgerSide];

export const BillingLedgerAccountCode = {
	CUSTOMER_CREDIT: 'customer_credit',
	PLATFORM_MARKUP_PENDING: 'platform_markup_pending',
	PLATFORM_MARKUP_REVENUE: 'platform_markup_revenue',
	PLATFORM_SERVICE_REVENUE: 'platform_service_revenue',
	PLATFORM_QUALIFICATION_EXPENSE: 'platform_qualification_expense',
	HOST_EARNINGS_PENDING: 'host_earnings_pending',
	HOST_EARNINGS_CREDITED: 'host_earnings_credited',
	ESCROW_CUSTODY: 'escrow_custody',
	ESCROW_WITHDRAWAL_PENDING: 'escrow_withdrawal_pending',
	ESCROW_HOST_CREDITED: 'escrow_host_credited',
	ESCROW_FEES_ACCRUED: 'escrow_fees_accrued',
	ESCROW_FROZEN: 'escrow_frozen',
	PLATFORM_WALLET: 'platform_wallet',
} as const;

export type BillingLedgerAccountCode =
	(typeof BillingLedgerAccountCode)[keyof typeof BillingLedgerAccountCode];

export const BILLING_LEDGER_NORMAL_SIDE: Readonly<
	Record<BillingLedgerAccountCode, BillingLedgerSide>
> = {
	[BillingLedgerAccountCode.CUSTOMER_CREDIT]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.PLATFORM_MARKUP_PENDING]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.PLATFORM_SERVICE_REVENUE]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.PLATFORM_QUALIFICATION_EXPENSE]:
		BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.HOST_EARNINGS_PENDING]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.HOST_EARNINGS_CREDITED]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.ESCROW_CUSTODY]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.ESCROW_WITHDRAWAL_PENDING]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.ESCROW_HOST_CREDITED]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.ESCROW_FEES_ACCRUED]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.ESCROW_FROZEN]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.PLATFORM_WALLET]: BillingLedgerSide.DEBIT,
};

export const BillingLedgerOwnerKind = {
	ORGANIZATION: 'organization',
	PLATFORM: 'platform',
} as const;

export type BillingLedgerOwnerKind =
	(typeof BillingLedgerOwnerKind)[keyof typeof BillingLedgerOwnerKind];

export const BYTES_PER_GIGABYTE = 1_000_000_000;

export const STORAGE_FREE_GIB = 10n;
export const STORAGE_BACKFILL_HOURS = 72;

export const BILLING_LEDGER_PLATFORM_OWNER = 'snapflow';
export const BILLING_LEDGER_CURRENCY = 'USD' as const;
export const BILLING_LEDGER_SOURCE_VERSION = 1;

export const BillingLedgerSourceType = {
	LINE_USAGE: 'billing_line_usage',
	QUALIFICATION_CREDIT: 'qualification_credit',
	ESCROW_DEPOSIT: 'escrow_deposit',
	ESCROW_WITHDRAWAL: 'escrow_withdrawal',
	ESCROW_CLAIM: 'escrow_claim',
	ESCROW_WITHDRAWAL_REQUEST: 'escrow_withdrawal_request',
	ESCROW_HOST_WITHDRAWAL: 'escrow_host_withdrawal',
	ESCROW_FEE_SWEEP: 'escrow_fee_sweep',
	ESCROW_FREEZE: 'escrow_freeze',
	ESCROW_FROZEN_RELEASE: 'escrow_frozen_release',
	STORAGE_CHARGE: 'storage_charge',
	PAYMENT_CHANNEL_REFUND: 'payment_channel_refund',
} as const;

export const BillingLedgerDescriptionCode = {
	USAGE_CHARGED: 'usage_charged',
	QUALIFICATION_CREDIT_GRANTED: 'qualification_credit_granted',
	ESCROW_DEPOSITED: 'escrow_deposited',
	ESCROW_WITHDRAWN: 'escrow_withdrawn',
	ESCROW_CLAIMED: 'escrow_claimed',
	ESCROW_WITHDRAWAL_REQUESTED: 'escrow_withdrawal_requested',
	ESCROW_WITHDRAWAL_CANCELLED: 'escrow_withdrawal_cancelled',
	ESCROW_HOST_WITHDRAWN: 'escrow_host_withdrawn',
	ESCROW_FEES_SWEPT: 'escrow_fees_swept',
	ESCROW_FROZEN: 'escrow_frozen',
	ESCROW_FROZEN_RELEASED: 'escrow_frozen_released',
	STORAGE_CHARGED: 'storage_charged',
	PAYMENT_CHANNEL_REFUNDED: 'payment_channel_refunded',
} as const;

export const BILLING_NUMERIC_PRECISION = {
	MONEY: 40,
} as const;

export const BILLING_NUMERIC_SCALE = {
	MONEY: 0,
} as const;

export const BILLING_COLUMN_LENGTH = {
	EVIDENCE_DIGEST: 64,
} as const;

export const BILLING_USAGE_QUERY = {
	defaultLimit: 25,
	maximumLimit: 100,
} as const;

export const BILLING_LINE_SCHEMA_VERSION = 4;
export const BILLING_EXPORT_SCHEMA_VERSION = 4;
export const BILLING_EXPORT_FOCUS_VERSION = '1.2';
export const BILLING_POLICY_VERSION = 1;
export const DEFAULT_BUDGET_WARNING_THRESHOLD_BASIS_POINTS = 8_000;

export const BillingLineSourceType = {
	SANDBOX_USAGE_PERIOD: 'sandbox_usage_period',
	NETWORK_USAGE_PERIOD: 'network_usage_period',
} as const;

export type BillingLineSourceType =
	(typeof BillingLineSourceType)[keyof typeof BillingLineSourceType];

export const BillingLineCategory = {
	COMPUTE: 'compute',
	STORAGE: 'storage',
} as const;

export type BillingLineCategory =
	(typeof BillingLineCategory)[keyof typeof BillingLineCategory];

export const EVIDENCE_QUARANTINED = 'evidence_quarantined';

export const BillingAdjustmentReasonCode = {
	USAGE_ATTESTATION_SHORTFALL: 'usage_attestation_shortfall',
	EVIDENCE_QUARANTINED,
	EARLY_SESSION_FAILURE: 'early_session_failure',
} as const;

export type BillingAdjustmentReasonCode =
	(typeof BillingAdjustmentReasonCode)[keyof typeof BillingAdjustmentReasonCode];

export const BillingReconciliationReason = {
	PARTIALLY_ATTESTED: 'usage_partially_attested',
	UNATTESTED: 'usage_unattested',
	EVIDENCE_QUARANTINED,
} as const;

export type BillingReconciliationReason =
	(typeof BillingReconciliationReason)[keyof typeof BillingReconciliationReason];

export const BILLING_EVIDENCE_RETENTION = {
	batchSize: 1_000,
	maximumBatches: 100,
	maximumPlacementsPerRun: 5_000,
} as const;
