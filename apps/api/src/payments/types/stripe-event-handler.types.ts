/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type Stripe from 'stripe';
import type { StripeEventType } from '../constants/stripe.constants';
import type { StripeEventScope } from '../enums/stripe-event-scope.enum';

export type StripeEventOf<Type extends StripeEventType> = Extract<
	Stripe.V2.Core.Event,
	{ type: Type }
>;

export interface StripeEventHandler<
	Type extends StripeEventType = StripeEventType,
> {
	readonly eventTypes: readonly Type[];
	handle(event: StripeEventOf<Type>, scope: StripeEventScope): Promise<void>;
}
