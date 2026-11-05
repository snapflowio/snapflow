/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type Stripe from 'stripe';
import { MILLISECONDS_PER_HOUR } from '../../common/constants/time.constants';

type WeeklyPayoutDay =
	Stripe.BalanceSettingsUpdateParams.Payments.Payouts.Schedule.WeeklyPayoutDay;

export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

export const STRIPE_EVENT_HANDLERS = Symbol('STRIPE_EVENT_HANDLERS');

export const STRIPE_WEEKLY_PAYOUT_DAY: Readonly<
	Record<number, WeeklyPayoutDay>
> = {
	1: 'monday',
	2: 'tuesday',
	3: 'wednesday',
	4: 'thursday',
	5: 'friday',
	6: 'monday',
	7: 'monday',
};

export const STRIPE_PAYOUT_INTERVAL = 'weekly';

export const STRIPE_API_VERSION = '2026-09-30.endive';
export const STRIPE_MAX_NETWORK_RETRIES = 3;
export const STRIPE_APP_NAME = 'snapflow';
export const STRIPE_CURRENCY = 'usd';
export const STRIPE_DASHBOARD = 'express';
export const STRIPE_RESPONSIBLE_PARTY = 'application';
export const STRIPE_SIGNATURE_HEADER = 'stripe-signature';
export const STRIPE_TRANSFER_GROUP_PREFIX = 'payout_batch_';
export const STRIPE_TAX_ADDRESS_SOURCE = 'billing';
export const STRIPE_TAX_BEHAVIOR = 'exclusive';

// Stripe keeps idempotency keys for at least 24 hours; stay safely inside that.
export const STRIPE_IDEMPOTENCY_SAFE_MILLISECONDS = 20 * MILLISECONDS_PER_HOUR;

export const HOST_BUSINESS_PROFILE = {
	mcc: '7372',
	product_description:
		'Rents out spare computing capacity (CPU, GPU, memory and storage) to customers of the Snapflow compute marketplace.',
} as const satisfies Stripe.AccountUpdateParams.BusinessProfile;

export const CREDIT_PRODUCT_NAME = 'Snapflow compute credit';
export const CREDIT_PRODUCT_TAX_CODE = 'txcd_10101000';
export const CREDIT_PRODUCT_QUANTITY = 1;

export const STRIPE_WEBHOOK_ROUTE = {
	BASE: 'stripe/webhooks',
	PLATFORM: 'platform',
	CONNECT: 'connect',
} as const;

export const StripeMetadataKey = {
	ORGANIZATION_ID: 'snapflow_organization_id',
	TOP_UP_ID: 'snapflow_top_up_id',
	TOP_UP_KIND: 'snapflow_top_up_kind',
	PAYOUT_ID: 'snapflow_payout_id',
} as const;

export const StripeIdempotencyPrefix = {
	ACCOUNT: 'account',
	ACCOUNT_CONFIGURATION: 'account_configuration',
	BALANCE_SETTINGS: 'balance_settings',
	BUSINESS_PROFILE: 'business_profile',
	TOP_UP: 'top_up',
	TAX_CALCULATION: 'tax_calculation',
	PAYOUT: 'payout',
} as const;

export type StripeIdempotencyPrefix =
	(typeof StripeIdempotencyPrefix)[keyof typeof StripeIdempotencyPrefix];

export const StripeAccountConfiguration = {
	CUSTOMER: 'customer',
	RECIPIENT: 'recipient',
} as const;

export type StripeAccountConfiguration =
	(typeof StripeAccountConfiguration)[keyof typeof StripeAccountConfiguration];

export const STRIPE_ACCOUNT_INCLUDE = [
	'configuration.customer',
	'configuration.recipient',
	'identity',
	'requirements',
] as const;

export const StripeEventType = {
	PAYMENT_INTENT_SUCCEEDED: 'v1.payment_intent.succeeded',
	PAYMENT_INTENT_PAYMENT_FAILED: 'v1.payment_intent.payment_failed',
	PAYMENT_INTENT_REQUIRES_ACTION: 'v1.payment_intent.requires_action',
	CHECKOUT_SESSION_COMPLETED: 'v1.checkout.session.completed',
	CHECKOUT_SESSION_EXPIRED: 'v1.checkout.session.expired',
	CHARGE_UPDATED: 'v1.charge.updated',
	REFUND_CREATED: 'v1.refund.created',
	REFUND_UPDATED: 'v1.refund.updated',
	REFUND_FAILED: 'v1.refund.failed',
	CHARGE_DISPUTE_CREATED: 'v1.charge.dispute.created',
	CHARGE_DISPUTE_UPDATED: 'v1.charge.dispute.updated',
	CHARGE_DISPUTE_CLOSED: 'v1.charge.dispute.closed',
	CHARGE_DISPUTE_FUNDS_WITHDRAWN: 'v1.charge.dispute.funds_withdrawn',
	CHARGE_DISPUTE_FUNDS_REINSTATED: 'v1.charge.dispute.funds_reinstated',
	EARLY_FRAUD_WARNING_CREATED: 'v1.radar.early_fraud_warning.created',
	TRANSFER_CREATED: 'v1.transfer.created',
	TRANSFER_UPDATED: 'v1.transfer.updated',
	TRANSFER_REVERSED: 'v1.transfer.reversed',
	PAYOUT_CREATED: 'v1.payout.created',
	PAYOUT_PAID: 'v1.payout.paid',
	PAYOUT_FAILED: 'v1.payout.failed',
	PAYMENT_METHOD_DETACHED: 'v1.payment_method.detached',
	PAYMENT_METHOD_AUTOMATICALLY_UPDATED:
		'v1.payment_method.automatically_updated',
	EXTERNAL_ACCOUNT_UPDATED: 'v1.account.external_account.updated',
	ACCOUNT_REQUIREMENTS_UPDATED: 'v2.core.account[requirements].updated',
	ACCOUNT_RECIPIENT_CAPABILITY_STATUS_UPDATED:
		'v2.core.account[configuration.recipient].capability_status_updated',
	ACCOUNT_CLOSED: 'v2.core.account.closed',
} as const;

export type StripeEventType =
	(typeof StripeEventType)[keyof typeof StripeEventType];

export const StripeDeclineCode = {
	AUTHENTICATION_REQUIRED: 'authentication_required',
} as const;

export const StripePaymentIntentStatus = {
	SUCCEEDED: 'succeeded',
	REQUIRES_ACTION: 'requires_action',
	REQUIRES_PAYMENT_METHOD: 'requires_payment_method',
	CANCELED: 'canceled',
} as const satisfies Record<string, Stripe.PaymentIntent.Status>;

export const StripeRefundStatus = {
	FAILED: 'failed',
} as const;

export const StripeBalanceTransactionType = {
	CHARGE: 'charge',
	PAYMENT: 'payment',
	ADJUSTMENT: 'adjustment',
	REFUND: 'refund',
	REFUND_FAILURE: 'refund_failure',
	TRANSFER: 'transfer',
	TRANSFER_REFUND: 'transfer_refund',
	PAYOUT: 'payout',
	PAYOUT_FAILURE: 'payout_failure',
	STRIPE_FEE: 'stripe_fee',
	TAX_FEE: 'tax_fee',
} as const;

export const StripeTransfersCapabilityStatus = {
	ACTIVE: 'active',
	PENDING: 'pending',
	RESTRICTED: 'restricted',
} as const;

export const StripeErrorCode = {
	BALANCE_INSUFFICIENT: 'balance_insufficient',
} as const;

// Request fields whose Stripe errors name an object Snapflow stored the id of.
export const StripeRequestParam = {
	CUSTOMER_ACCOUNT: 'customer_account',
	DESTINATION: 'destination',
	PAYMENT_METHOD: 'payment_method',
} as const;

export const STRIPE_SAVED_PAYMENT_METHOD_REDISPLAY =
	'always' satisfies Stripe.PaymentMethod.AllowRedisplay;
