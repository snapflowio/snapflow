/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import Stripe from 'stripe';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { STRIPE_EVENT_PROCESSING } from '../../constants/payments.constants';
import { STRIPE_API_VERSION } from '../../constants/stripe.constants';
import { StripeEventScope } from '../../enums/stripe-event-scope.enum';
import { StripeEventHandlerRegistry } from '../../handlers/stripe-event/stripe-event-handler.registry';
import { StripeEventProcessorService } from './stripe-event-processor.service';

const EVENT_ID = 'evt_failing';
const SERVER_ERROR = 500;
const CLAIM_MARKER = 'SET "attempts"';
const DEAD_LETTER_MARKER = '"deadLetteredAt" = transaction_timestamp()';
const DEFER_MARKER = 'SET "nextAttemptAt"';

function failingStripe(): Stripe {
	return new Stripe('sk_test_fixture', {
		apiVersion: STRIPE_API_VERSION,
		maxNetworkRetries: 0,
		httpClient: Stripe.createFetchHttpClient(async () =>
			Response.json(
				{ error: { type: 'api_error', message: 'unavailable' } },
				{ status: SERVER_ERROR }
			)
		),
	});
}

async function processFailingEvent(attempts: number): Promise<string[]> {
	const statements: string[] = [];
	let claimed = false;
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'fork', () => manager);
	mock.method(manager, 'execute', async (sql: string) => {
		statements.push(sql);
		if (!sql.includes(CLAIM_MARKER) || claimed) return [];
		claimed = true;
		return [
			{
				id: EVENT_ID,
				scope: StripeEventScope.PLATFORM,
				context: null,
				attempts,
				receivedAt: new Date(0),
			},
		];
	});
	const service = new StripeEventProcessorService(
		manager,
		failingStripe(),
		new StripeEventHandlerRegistry([])
	);
	await service.processPending();
	return statements;
}

describe('StripeEventProcessorService retries', () => {
	it('defers a failed event while it has attempts left', async () => {
		const statements = await processFailingEvent(
			STRIPE_EVENT_PROCESSING.maximumAttempts - 1
		);

		assert.ok(statements.some((sql) => sql.includes(DEFER_MARKER)));
		assert.ok(!statements.some((sql) => sql.includes(DEAD_LETTER_MARKER)));
	});

	it('dead-letters an event that failed its last attempt', async () => {
		const statements = await processFailingEvent(
			STRIPE_EVENT_PROCESSING.maximumAttempts
		);

		assert.ok(statements.some((sql) => sql.includes(DEAD_LETTER_MARKER)));
		assert.ok(!statements.some((sql) => sql.includes(DEFER_MARKER)));
	});
});
