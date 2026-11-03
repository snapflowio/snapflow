/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type Stripe from 'stripe';
import { STRIPE_EVENT_PROCESSING } from '../constants/payments.constants';

const RETRY_GROWTH_FACTOR = 2;
const FIRST_ATTEMPT = 1;

export function stripeEventRetryDelaySeconds(attempts: number): number {
	const exponent = Math.max(attempts - FIRST_ATTEMPT, 0);
	return Math.min(
		STRIPE_EVENT_PROCESSING.retryBaseSeconds * RETRY_GROWTH_FACTOR ** exponent,
		STRIPE_EVENT_PROCESSING.retryMaximumSeconds
	);
}

export function connectedAccountContext(event: Stripe.V2.Core.Event): string {
	if (!event.context) {
		throw new Error(`Stripe event ${event.id} has no connected account`);
	}
	return event.context;
}
