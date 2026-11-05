/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Inject, Injectable } from '@nestjs/common';
import type Stripe from 'stripe';
import {
	STRIPE_EVENT_HANDLERS,
	StripeEventType,
} from '../../constants/stripe.constants';
import type { StripeEventScope } from '../../enums/stripe-event-scope.enum';
import type {
	StripeEventHandler,
	StripeEventOf,
} from '../../types/stripe-event-handler.types';

const KNOWN_EVENT_TYPES: ReadonlySet<string> = new Set(
	Object.values(StripeEventType)
);

function isKnownEvent(
	event: Stripe.V2.Core.Event
): event is StripeEventOf<StripeEventType> {
	return KNOWN_EVENT_TYPES.has(event.type);
}

@Injectable()
export class StripeEventHandlerRegistry {
	private readonly handlers = new Map<string, StripeEventHandler>();

	constructor(
		@Inject(STRIPE_EVENT_HANDLERS) handlers: readonly StripeEventHandler[]
	) {
		for (const handler of handlers) {
			for (const type of handler.eventTypes) {
				if (this.handlers.has(type)) {
					throw new Error(
						`Stripe event type ${type} has more than one handler`
					);
				}
				this.handlers.set(type, handler);
			}
		}
	}

	async dispatch(
		event: Stripe.V2.Core.Event,
		scope: StripeEventScope
	): Promise<boolean> {
		const handler = this.handlers.get(event.type);
		if (!handler || !isKnownEvent(event)) return false;
		await handler.handle(event, scope);
		return true;
	}
}
