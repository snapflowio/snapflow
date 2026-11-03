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
	HOST_EARNINGS_PAYABLE: 'host_earnings_payable',
	PLATFORM_MARKUP_REVENUE: 'platform_markup_revenue',
	PLATFORM_QUALIFICATION_EXPENSE: 'platform_qualification_expense',
	HOST_EARNINGS_PENDING: 'host_earnings_pending',
	STRIPE_BALANCE: 'stripe_balance',
	PAYMENT_PROCESSING_FEES: 'payment_processing_fees',
	STRIPE_PLATFORM_FEES: 'stripe_platform_fees',
	DISPUTE_FEES: 'dispute_fees',
	DISPUTED_FUNDS: 'disputed_funds',
	DISPUTE_LOSSES: 'dispute_losses',
	REFUND_LOSSES: 'refund_losses',
	HOST_TRANSFERS_PENDING: 'host_transfers_pending',
	STRIPE_PAYOUTS_IN_TRANSIT: 'stripe_payouts_in_transit',
	PLATFORM_BANK_CASH: 'platform_bank_cash',
	SALES_TAX_PAYABLE: 'sales_tax_payable',
} as const;

export type BillingLedgerAccountCode =
	(typeof BillingLedgerAccountCode)[keyof typeof BillingLedgerAccountCode];

export const BILLING_LEDGER_NORMAL_SIDE: Readonly<
	Record<BillingLedgerAccountCode, BillingLedgerSide>
> = {
	[BillingLedgerAccountCode.CUSTOMER_CREDIT]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.ADMIN_CREDIT_GRANTS]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.HOST_EARNINGS_PAYABLE]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.PLATFORM_QUALIFICATION_EXPENSE]:
		BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.HOST_EARNINGS_PENDING]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.STRIPE_BALANCE]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.PAYMENT_PROCESSING_FEES]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.STRIPE_PLATFORM_FEES]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.DISPUTE_FEES]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.DISPUTED_FUNDS]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.DISPUTE_LOSSES]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.REFUND_LOSSES]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.HOST_TRANSFERS_PENDING]: BillingLedgerSide.CREDIT,
	[BillingLedgerAccountCode.STRIPE_PAYOUTS_IN_TRANSIT]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.PLATFORM_BANK_CASH]: BillingLedgerSide.DEBIT,
	[BillingLedgerAccountCode.SALES_TAX_PAYABLE]: BillingLedgerSide.CREDIT,
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
	EARNINGS_MATURITY: 'earnings_maturity',
	EARNINGS_FORFEITURE: 'earnings_forfeiture',
	STRIPE_TOP_UP: 'stripe_top_up',
	STRIPE_CHARGE_FEE: 'stripe_charge_fee',
	STRIPE_DISPUTE_WITHDRAWAL: 'stripe_dispute_withdrawal',
	STRIPE_DISPUTE_FREEZE: 'stripe_dispute_freeze',
	STRIPE_DISPUTE_REINSTATEMENT: 'stripe_dispute_reinstatement',
	STRIPE_DISPUTE_LOSS: 'stripe_dispute_loss',
	STRIPE_REFUND: 'stripe_refund',
	STRIPE_REFUND_FAILURE: 'stripe_refund_failure',
	PAYOUT_COMMIT: 'payout_commit',
	PAYOUT_TRANSFER: 'payout_transfer',
	PAYOUT_TRANSFER_REVERSAL: 'payout_transfer_reversal',
	PAYOUT_FAILURE: 'payout_failure',
	STRIPE_PLATFORM_PAYOUT: 'stripe_platform_payout',
	STRIPE_PLATFORM_PAYOUT_PAID: 'stripe_platform_payout_paid',
	STRIPE_PLATFORM_PAYOUT_FAILED: 'stripe_platform_payout_failed',
	STRIPE_PLATFORM_FEE: 'stripe_platform_fee',
	QUALIFICATION_CREDIT: 'qualification_credit',
} as const;

export const BillingLedgerDescriptionCode = {
	USAGE_CHARGED: 'usage_charged',
	ADMIN_CREDIT_GRANTED: 'admin_credit_granted',
	EARNINGS_MATURED: 'earnings_matured',
	EARNINGS_FORFEITED: 'earnings_forfeited',
	TOP_UP_SUCCEEDED: 'top_up_succeeded',
	CARD_FEE_CHARGED: 'card_fee_charged',
	DISPUTE_FUNDS_WITHDRAWN: 'dispute_funds_withdrawn',
	DISPUTE_CREDIT_FROZEN: 'dispute_credit_frozen',
	DISPUTE_FUNDS_REINSTATED: 'dispute_funds_reinstated',
	DISPUTE_LOST: 'dispute_lost',
	TOP_UP_REFUNDED: 'top_up_refunded',
	TOP_UP_REFUND_FAILED: 'top_up_refund_failed',
	PAYOUT_COMMITTED: 'payout_committed',
	PAYOUT_TRANSFERRED: 'payout_transferred',
	PAYOUT_TRANSFER_REVERSED: 'payout_transfer_reversed',
	PAYOUT_FAILED: 'payout_failed',
	PLATFORM_PAYOUT_CREATED: 'platform_payout_created',
	PLATFORM_PAYOUT_PAID: 'platform_payout_paid',
	PLATFORM_PAYOUT_FAILED: 'platform_payout_failed',
	STRIPE_FEE_CHARGED: 'stripe_fee_charged',
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
