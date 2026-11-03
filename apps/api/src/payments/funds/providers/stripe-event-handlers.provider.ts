/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Provider, Type } from '@nestjs/common';
import { STRIPE_EVENT_HANDLERS } from '../constants/stripe.constants';
import {
	AccountChangedHandler,
	ExternalAccountUpdatedHandler,
} from '../handlers/stripe-event/account-event.handler';
import { ChargeUpdatedHandler } from '../handlers/stripe-event/charge-event.handler';
import {
	CheckoutSessionCompletedHandler,
	CheckoutSessionExpiredHandler,
} from '../handlers/stripe-event/checkout-session-event.handler';
import {
	DisputeChangedHandler,
	DisputeCreatedHandler,
	EarlyFraudWarningCreatedHandler,
} from '../handlers/stripe-event/dispute-event.handler';
import {
	PaymentIntentPaymentFailedHandler,
	PaymentIntentRequiresActionHandler,
	PaymentIntentSucceededHandler,
} from '../handlers/stripe-event/payment-intent-event.handler';
import {
	PaymentMethodAutomaticallyUpdatedHandler,
	PaymentMethodDetachedHandler,
} from '../handlers/stripe-event/payment-method-event.handler';
import {
	PayoutCreatedHandler,
	PayoutFailedHandler,
	PayoutPaidHandler,
} from '../handlers/stripe-event/payout-event.handler';
import { RefundChangedHandler } from '../handlers/stripe-event/refund-event.handler';
import { StripeEventHandlerRegistry } from '../handlers/stripe-event/stripe-event-handler.registry';
import {
	TransferChangedHandler,
	TransferReversedHandler,
} from '../handlers/stripe-event/transfer-event.handler';
import type { StripeEventHandler } from '../types/stripe-event-handler.types';

export const STRIPE_EVENT_HANDLER_TYPES: readonly Type<StripeEventHandler>[] = [
	PaymentIntentSucceededHandler,
	PaymentIntentPaymentFailedHandler,
	PaymentIntentRequiresActionHandler,
	CheckoutSessionCompletedHandler,
	CheckoutSessionExpiredHandler,
	ChargeUpdatedHandler,
	RefundChangedHandler,
	PaymentMethodDetachedHandler,
	PaymentMethodAutomaticallyUpdatedHandler,
	DisputeCreatedHandler,
	DisputeChangedHandler,
	EarlyFraudWarningCreatedHandler,
	TransferChangedHandler,
	TransferReversedHandler,
	PayoutCreatedHandler,
	PayoutPaidHandler,
	PayoutFailedHandler,
	ExternalAccountUpdatedHandler,
	AccountChangedHandler,
];

export const stripeEventHandlerProviders: Provider[] = [
	...STRIPE_EVENT_HANDLER_TYPES,
	{
		provide: STRIPE_EVENT_HANDLERS,
		useFactory: (...handlers: StripeEventHandler[]) => handlers,
		inject: [...STRIPE_EVENT_HANDLER_TYPES],
	},
	StripeEventHandlerRegistry,
];
