/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const BillingChargeClass = {
	COMPUTE: 'compute',
	NETWORK: 'network',
} as const;

export type BillingChargeClass =
	(typeof BillingChargeClass)[keyof typeof BillingChargeClass];

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

export const PlacementFundingState = {
	HEALTHY: 'healthy',
	WARNING: 'warning',
	SUSPENSION_PENDING: 'suspension_pending',
	SUSPENDED: 'suspended',
} as const;

export type PlacementFundingState =
	(typeof PlacementFundingState)[keyof typeof PlacementFundingState];

export const BillingAdmissionBlocker = {
	FUNDING_REQUIRED: 'funding_required',
	FUNDING_EXHAUSTED: 'funding_exhausted',
	MONTHLY_BUDGET_EXHAUSTED: 'monthly_budget_exhausted',
	NETWORK_BUDGET_EXHAUSTED: 'network_budget_exhausted',
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
	CURRENT_RESERVED_RUN_RATE: 'current_reserved_run_rate',
	ACTUAL_ONLY: 'actual_only',
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
	ADMIN_CREDIT_GRANTS: 'admin_credit_grants',
	PLATFORM_MARKUP_REVENUE: 'platform_markup_revenue',
	PLATFORM_QUALIFICATION_EXPENSE: 'platform_qualification_expense',
	HOST_EARNINGS_PENDING: 'host_earnings_pending',
} as const;

export type BillingLedgerAccountCode =
	(typeof BillingLedgerAccountCode)[keyof typeof BillingLedgerAccountCode];

export const BILLING_LEDGER_NORMAL_SIDE: Readonly<
	Record<BillingLedgerAccountCode, BillingLedgerSide>
> = {
	[BillingLedgerAccountCode.CUSTOMER_CREDIT]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.ADMIN_CREDIT_GRANTS]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.PLATFORM_QUALIFICATION_EXPENSE]:
		BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.HOST_EARNINGS_PENDING]: BillingLedgerSide.CREDIT,
};

export const BillingLedgerOwnerKind = {
	ORGANIZATION: 'organization',
	PLATFORM: 'platform',
} as const;

export type BillingLedgerOwnerKind =
	(typeof BillingLedgerOwnerKind)[keyof typeof BillingLedgerOwnerKind];

export const BILLING_LEDGER_PLATFORM_OWNER = 'snapflow';
export const BILLING_LEDGER_CURRENCY = 'USD' as const;
export const BILLING_LEDGER_SOURCE_VERSION = 1;

export const BillingLedgerSourceType = {
	LINE_USAGE: 'billing_line_usage',
	ADMIN_CREDIT_GRANT: 'admin_credit_grant',
	EARNINGS_FORFEITURE: 'earnings_forfeiture',
	QUALIFICATION_CREDIT: 'qualification_credit',
} as const;

export const BillingLedgerDescriptionCode = {
	USAGE_CHARGED: 'usage_charged',
	ADMIN_CREDIT_GRANTED: 'admin_credit_granted',
	EARNINGS_FORFEITED: 'earnings_forfeited',
	QUALIFICATION_CREDIT_GRANTED: 'qualification_credit_granted',
} as const;

export const ADMIN_CREDIT_GRANT_LIMITS = {
	MAXIMUM_MICRO_USD: 100_000_000_000,
	MAXIMUM_REASON_LENGTH: 500,
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

export const EVIDENCE_QUARANTINED = 'evidence_quarantined';

export const BillingAdjustmentReasonCode = {
	USAGE_ATTESTATION_SHORTFALL: 'usage_attestation_shortfall',
	EVIDENCE_QUARANTINED,
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
