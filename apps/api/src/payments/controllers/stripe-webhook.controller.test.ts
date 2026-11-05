/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import Stripe from 'stripe';
import { API_GLOBAL_PREFIX } from '../../common/constants/api-path.constants';
import { fakeInstance } from '../../common/testing/instance.fake';
import { DEPLOYMENT_PROFILES } from '../../config/constants/deployment-profile.constants';
import { DeploymentEnvironment } from '../../config/enums/deployment-environment.enum';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { configureBodyParsers } from '../../http/body-parsers.config';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import { STRIPE_EVENT_WAKE } from '../constants/payments.constants';
import { STRIPE_CLIENT } from '../constants/stripe.constants';
import { StripeEventScope } from '../enums/stripe-event-scope.enum';
import { createStripeClient } from '../providers/stripe-client.provider';
import { StripeEventInboxService } from '../services/stripe-event/stripe-event-inbox.service';
import { StripeWebhookController } from './stripe-webhook.controller';

const PLATFORM_SECRET = 'whsec_platform_fixture';
const CONNECT_SECRET = 'whsec_connect_fixture';
const API_PREFIX = API_GLOBAL_PREFIX;
const CONNECTED_ACCOUNT = 'acct_fixture';

interface StoredEvent {
	id: string;
	scope: string;
	type: string;
	relatedObjectId: string | null;
	context: string | null;
	livemode: boolean;
}

class FakeInboxStore {
	readonly events = new Map<string, StoredEvent>();
	readonly manager = fakeInstance(EntityManager);

	constructor() {
		Object.defineProperty(this.manager, 'fork', { value: () => this.manager });
		Object.defineProperty(this.manager, 'execute', {
			value: async (sql: string, parameters: unknown[]) => {
				assert.match(sql, /ON CONFLICT \("id"\) DO NOTHING/);
				const [id, scope, type, relatedObjectId, context, livemode] =
					parameters;
				if (typeof id !== 'string' || this.events.has(id)) return [];
				this.events.set(id, {
					id,
					scope: String(scope),
					type: String(type),
					relatedObjectId:
						relatedObjectId === null ? null : String(relatedObjectId),
					context: context === null ? null : String(context),
					livemode: livemode === true,
				});
				return [{ id }];
			},
		});
	}
}

class RecordingWake {
	readonly notified: string[] = [];

	notify(topic: string, ids: Iterable<string>): void {
		for (const id of ids) this.notified.push(`${topic}:${id}`);
	}
}

const CONFIG: Readonly<Record<string, unknown>> = {
	deployment: DEPLOYMENT_PROFILES[DeploymentEnvironment.DEVELOPMENT],
	'stripe.platformWebhookSecret': PLATFORM_SECRET,
	'stripe.connectWebhookSecret': CONNECT_SECRET,
};

function thinEvent(id: string, context?: string, livemode = false): string {
	return JSON.stringify({
		id,
		object: 'v2.core.event',
		type: 'v1.payment_intent.succeeded',
		livemode,
		created: '2026-10-14T12:00:00.000Z',
		...(context ? { context } : {}),
		related_object: {
			id: 'pi_fixture',
			type: 'payment_intent',
			url: '/v1/payment_intents/pi_fixture',
		},
	});
}

describe('Stripe webhooks through the raw body parser', () => {
	const store = new FakeInboxStore();
	const wake = new RecordingWake();
	let app: NestExpressApplication;
	let baseUrl: string;

	before(async () => {
		@Module({
			controllers: [StripeWebhookController],
			providers: [
				StripeEventInboxService,
				{ provide: EntityManager, useValue: store.manager },
				{
					provide: STRIPE_CLIENT,
					useValue: createStripeClient('sk_test_fixture'),
				},
				{
					provide: TypedConfigService,
					useValue: { get: (key: string) => CONFIG[key] },
				},
				{ provide: ControlWakeService, useValue: wake },
			],
		})
		class WebhookTestModule {}

		app = await NestFactory.create<NestExpressApplication>(WebhookTestModule, {
			bodyParser: false,
			rawBody: true,
			logger: false,
		});
		configureBodyParsers(app);
		app.setGlobalPrefix(API_PREFIX);
		await app.listen(0, '127.0.0.1');
		baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
	});

	after(async () => {
		await app.close();
	});

	function deliver(path: string, payload: string, secret: string) {
		return fetch(`${baseUrl}/${API_PREFIX}/stripe/webhooks/${path}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'stripe-signature': Stripe.webhooks.generateTestHeaderString({
					payload,
					secret,
				}),
			},
			body: payload,
		});
	}

	it('verifies the platform signature over the raw body and stores the event once', async () => {
		const payload = thinEvent('evt_platform_1');
		const first = await deliver('platform', payload, PLATFORM_SECRET);
		const duplicate = await deliver('platform', payload, PLATFORM_SECRET);
		assert.equal(first.status, 200);
		assert.equal(duplicate.status, 200);
		assert.deepEqual(store.events.get('evt_platform_1'), {
			id: 'evt_platform_1',
			scope: StripeEventScope.PLATFORM,
			type: 'v1.payment_intent.succeeded',
			relatedObjectId: 'pi_fixture',
			context: null,
			livemode: false,
		});
		assert.deepEqual(wake.notified, [
			`${STRIPE_EVENT_WAKE.topic}:${STRIPE_EVENT_WAKE.id}`,
		]);
	});

	it('verifies connected-account events with the connect secret and keeps their context', async () => {
		const payload = thinEvent('evt_connect_1', CONNECTED_ACCOUNT);
		const response = await deliver('connect', payload, CONNECT_SECRET);
		assert.equal(response.status, 200);
		assert.equal(
			store.events.get('evt_connect_1')?.scope,
			StripeEventScope.CONNECT
		);
		assert.equal(store.events.get('evt_connect_1')?.context, CONNECTED_ACCOUNT);
	});

	it('acknowledges but ignores an event from the other Stripe mode', async () => {
		const response = await deliver(
			'platform',
			thinEvent('evt_live_1', undefined, true),
			PLATFORM_SECRET
		);
		assert.equal(response.status, 200);
		assert.equal(store.events.has('evt_live_1'), false);
	});

	it('refuses a signature made with the other destination secret', async () => {
		const response = await deliver(
			'platform',
			thinEvent('evt_wrong_secret'),
			CONNECT_SECRET
		);
		assert.equal(response.status, 400);
		assert.equal(store.events.has('evt_wrong_secret'), false);
	});

	it('refuses a body altered after signing', async () => {
		const payload = thinEvent('evt_tampered');
		const response = await fetch(
			`${baseUrl}/${API_PREFIX}/stripe/webhooks/platform`,
			{
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'stripe-signature': Stripe.webhooks.generateTestHeaderString({
						payload,
						secret: PLATFORM_SECRET,
					}),
				},
				body: payload.replace('evt_tampered', 'evt_forged'),
			}
		);
		assert.equal(response.status, 400);
		assert.equal(store.events.has('evt_forged'), false);
	});
});
