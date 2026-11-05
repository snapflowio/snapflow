/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type Stripe from 'stripe';
import { fakeValue } from '../../../common/testing/instance.fake';
import { StripeEventType } from '../../constants/stripe.constants';
import { StripeEventScope } from '../../enums/stripe-event-scope.enum';
import { STRIPE_EVENT_HANDLER_TYPES } from '../../providers/stripe-event-handlers.provider';
import type { StripeEventHandler } from '../../types/stripe-event-handler.types';
import { StripeEventHandlerRegistry } from './stripe-event-handler.registry';

const UNKNOWN_EVENT_TYPE = 'v1.customer.created';

function recordingHandler(
	handled: string[],
	...eventTypes: StripeEventType[]
): StripeEventHandler<StripeEventType> {
	return {
		eventTypes,
		handle: async (event) => {
			handled.push(event.type);
		},
	};
}

function event(type: string): Stripe.V2.Core.Event {
	return fakeValue<Stripe.V2.Core.Event>({ id: `evt_${type}`, type });
}

describe('Stripe event handler registry', () => {
	it('dispatches every event type a handler declares to that handler', async () => {
		const handled: string[] = [];
		const registry = new StripeEventHandlerRegistry([
			recordingHandler(
				handled,
				StripeEventType.TRANSFER_CREATED,
				StripeEventType.TRANSFER_UPDATED
			),
		]);

		for (const type of [
			StripeEventType.TRANSFER_CREATED,
			StripeEventType.TRANSFER_UPDATED,
		]) {
			assert.equal(
				await registry.dispatch(event(type), StripeEventScope.PLATFORM),
				true
			);
		}
		for (const type of [StripeEventType.PAYOUT_PAID, UNKNOWN_EVENT_TYPE]) {
			assert.equal(
				await registry.dispatch(event(type), StripeEventScope.PLATFORM),
				false
			);
		}
		assert.deepEqual(handled, [
			StripeEventType.TRANSFER_CREATED,
			StripeEventType.TRANSFER_UPDATED,
		]);
	});

	it('refuses two handlers for one event type', () => {
		assert.throws(
			() =>
				new StripeEventHandlerRegistry([
					recordingHandler([], StripeEventType.PAYOUT_PAID),
					recordingHandler([], StripeEventType.PAYOUT_PAID),
				]),
			/more than one handler/
		);
	});

	it('registers exactly one provider handler for every handled Stripe event type', () => {
		const handlers = STRIPE_EVENT_HANDLER_TYPES.map(
			(type): StripeEventHandler => Reflect.construct(type, [])
		);
		assert.doesNotThrow(() => new StripeEventHandlerRegistry(handlers));
		assert.deepEqual(
			handlers.flatMap((handler) => handler.eventTypes).sort(),
			Object.values(StripeEventType).sort()
		);
	});
});
