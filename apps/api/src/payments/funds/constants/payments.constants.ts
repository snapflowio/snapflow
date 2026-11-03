/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MILLISECONDS_PER_DAY,
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_MINUTE,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../../common/constants/time.constants';

export const COUNTRY_CODE_LENGTH = 2;

export const CARD_LAST_DIGITS_LENGTH = 4;

export const PAYMENTS_INITIAL_VERSION = 1;

export const PaymentsJob = {
	PROCESS_STRIPE_EVENTS: 'process-stripe-events',
	RUN_AUTO_TOP_UPS: 'run-auto-top-ups',
	MATURE_HOST_EARNINGS: 'mature-host-earnings',
	RUN_PAYOUTS: 'run-host-payouts',
	RECONCILE_STRIPE: 'reconcile-stripe-balance',
	SETTLE_TOP_UPS: 'settle-top-ups',
} as const;

export type PaymentsJob = (typeof PaymentsJob)[keyof typeof PaymentsJob];

export type ExclusivePaymentsJob = Exclude<
	PaymentsJob,
	typeof PaymentsJob.PROCESS_STRIPE_EVENTS
>;

export const PAYMENTS_JOB_LOCK_TTL_SECONDS: Readonly<
	Record<ExclusivePaymentsJob, number>
> = {
	[PaymentsJob.RUN_AUTO_TOP_UPS]: 5 * SECONDS_PER_MINUTE,
	[PaymentsJob.SETTLE_TOP_UPS]: 5 * SECONDS_PER_MINUTE,
	[PaymentsJob.MATURE_HOST_EARNINGS]: 30 * SECONDS_PER_MINUTE,
	[PaymentsJob.RUN_PAYOUTS]: SECONDS_PER_HOUR,
	[PaymentsJob.RECONCILE_STRIPE]: SECONDS_PER_HOUR,
};

export const STRIPE_EVENT_WAKE = {
	topic: 'stripe-event',
	id: 'inbox',
} as const;

export const STRIPE_EVENT_PROCESSING = {
	batchSize: 50,
	claimSeconds: 120,
	retryBaseSeconds: 10,
	retryMaximumSeconds: 6 * SECONDS_PER_HOUR,
	maximumAttempts: 16,
} as const;

export const TOP_UP_SETTLEMENT = {
	graceMilliseconds: 5 * MILLISECONDS_PER_MINUTE,
	batchSize: 100,
} as const;

export const AUTO_TOP_UP_MAXIMUM_CONSECUTIVE_FAILURES = 3;
export const AUTO_TOP_UP_BATCH_SIZE = 100;
export const EARNINGS_MATURITY_BATCH_SIZE = 500;
export const PAYOUT_BATCH_SIZE = 500;
export const PAYOUT_TIME_ZONE = 'UTC';
export const PAYOUT_TRANSFER_PAGE_SIZE = 100;

export const STRIPE_RECONCILIATION = {
	lookbackMilliseconds: 3 * MILLISECONDS_PER_DAY,
	pageSize: 100,
} as const;

export const PAYMENT_VELOCITY_WINDOW = {
	topUpAttemptsMilliseconds: MILLISECONDS_PER_HOUR,
	paymentMethodsMilliseconds: MILLISECONDS_PER_DAY,
} as const;

export const TOP_UP_ROUTE = {
	CONTROLLER: 'billing/top-ups',
	TEMPLATE: '/billing/top-ups',
} as const;

export const TOP_UP_RETURN_PATH = '/billing';
export const TOP_UP_RETURN_QUERY_KEY = 'topUpId';

export const PaymentSuspensionReason = {
	PAYMENT_DISPUTE: 'A payment of this organization was disputed',
	EARLY_FRAUD_WARNING: 'A payment of this organization was reported as fraud',
	SHARED_CARD:
		'A payment card of this organization is used by too many organizations',
} as const;

export type PaymentSuspensionReason =
	(typeof PaymentSuspensionReason)[keyof typeof PaymentSuspensionReason];

export const AutoTopUpSuspendedReason = {
	AUTHENTICATION_REQUIRED: 'authentication_required',
	PAYMENT_METHOD_DETACHED: 'payment_method_detached',
	CONSECUTIVE_FAILURES: 'consecutive_failures',
} as const;

export const PayoutsBlockedReason = {
	PAYOUT_FAILED: 'payout_failed',
	ACCOUNT_CLOSED: 'account_closed',
} as const;

export const TopUpFailureCode = {
	PAYMENT_ERROR: 'payment_error',
	TAX_LOCATION_UNAVAILABLE: 'tax_location_unavailable',
	ABANDONED: 'abandoned',
} as const;

export const PaymentsErrorCode = {
	TOP_UP_AMOUNT_OUT_OF_RANGE: 'top_up_amount_out_of_range',
	TOP_UP_ATTEMPTS_EXCEEDED: 'top_up_attempts_exceeded',
	TOP_UP_NOT_OPEN: 'top_up_not_open',
	PAYMENT_METHODS_EXCEEDED: 'payment_methods_exceeded',
	ORGANIZATION_SUSPENDED: 'organization_suspended',
	AUTO_TOP_UP_AMOUNT_TOO_LOW: 'auto_top_up_amount_too_low',
	AUTO_TOP_UP_AMOUNT_TOO_HIGH: 'auto_top_up_amount_too_high',
	AUTO_TOP_UP_VERSION_CONFLICT: 'auto_top_up_version_conflict',
	PAYOUT_COUNTRY_UNSUPPORTED: 'payout_country_unsupported',
	PAYOUT_ACCOUNT_MISSING: 'payout_account_missing',
	PAYMENT_ACCOUNT_UNAVAILABLE: 'payment_account_unavailable',
	PAYOUT_NOT_PENDING: 'payout_not_pending',
	STATEMENT_MONTH_INVALID: 'statement_month_invalid',
} as const;

export const STATEMENT_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
