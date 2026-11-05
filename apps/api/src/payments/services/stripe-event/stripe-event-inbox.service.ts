/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
} from '@nestjs/common';
import Stripe from 'stripe';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { STRIPE_EVENT_WAKE } from '../../constants/payments.constants';
import { STRIPE_CLIENT } from '../../constants/stripe.constants';
import { StripeEventScope } from '../../enums/stripe-event-scope.enum';
import { expectedStripeLivemode } from '../../providers/stripe-client.provider';

const INSERT_EVENT_SQL = `INSERT INTO "stripe_event"
	("id", "scope", "type", "relatedObjectId", "context", "livemode")
	VALUES (?, ?, ?, ?, ?, ?)
	ON CONFLICT ("id") DO NOTHING
	RETURNING "id"`;

@Injectable()
export class StripeEventInboxService {
	private readonly logger = new Logger(StripeEventInboxService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly config: TypedConfigService,
		private readonly wake: ControlWakeService
	) {}

	async accept(
		scope: StripeEventScope,
		rawBody: Buffer | undefined,
		signature: string | undefined
	): Promise<boolean> {
		if (!rawBody || !signature) {
			throw new BadRequestException('Stripe webhook body or signature missing');
		}
		const notification = this.verify(scope, rawBody, signature);
		if (
			notification.livemode !==
			expectedStripeLivemode(this.config.get('deployment'))
		) {
			this.logger.warn(
				`Ignoring Stripe event ${notification.id}: its livemode does not match the configured Stripe key`
			);
			return false;
		}
		const inserted = await this.entityManager
			.fork()
			.execute<{ id: string }[]>(INSERT_EVENT_SQL, [
				notification.id,
				scope,
				notification.type,
				this.relatedObjectId(notification),
				notification.context?.toString() ?? null,
				notification.livemode,
			]);
		if (inserted.length === 0) return false;
		this.wake.notify(STRIPE_EVENT_WAKE.topic, [STRIPE_EVENT_WAKE.id]);
		return true;
	}

	private verify(
		scope: StripeEventScope,
		rawBody: Buffer,
		signature: string
	): Stripe.V2.Core.EventNotification {
		try {
			return this.stripe.parseEventNotification(
				rawBody,
				signature,
				this.secret(scope)
			);
		} catch (error) {
			if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
				throw new BadRequestException('Stripe webhook signature is invalid');
			}
			throw error;
		}
	}

	private secret(scope: StripeEventScope): string {
		return scope === StripeEventScope.CONNECT
			? this.config.get('stripe.connectWebhookSecret')
			: this.config.get('stripe.platformWebhookSecret');
	}

	private relatedObjectId(
		notification: Stripe.V2.Core.EventNotification
	): string | null {
		const related =
			'related_object' in notification ? notification.related_object : null;
		return related && 'id' in related && typeof related.id === 'string'
			? related.id
			: null;
	}
}
