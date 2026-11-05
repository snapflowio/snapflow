/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { stripeErrorDetails } from '../../../common/utils/error/stripe-error.util';
import { parseDatabaseTimestamp } from '../../../infra/database/utils/database-time.util';
import { STRIPE_EVENT_PROCESSING } from '../../constants/payments.constants';
import { STRIPE_CLIENT } from '../../constants/stripe.constants';
import type { StripeEventScope } from '../../enums/stripe-event-scope.enum';
import { StripeEventHandlerRegistry } from '../../handlers/stripe-event/stripe-event-handler.registry';
import { stripeEventRetryDelaySeconds } from '../../utils/stripe-event.util';

interface ClaimedStripeEvent {
	id: string;
	scope: StripeEventScope;
	context: string | null;
	attempts: number;
	receivedAt: unknown;
}

const CLAIM_EVENTS_SQL = `UPDATE "stripe_event" AS event
	SET "attempts" = event."attempts" + 1,
		"nextAttemptAt" = transaction_timestamp() + make_interval(secs => ?)
	WHERE event.id IN (
		SELECT candidate.id
		FROM "stripe_event" candidate
		WHERE candidate."processedAt" IS NULL
		  AND candidate."deadLetteredAt" IS NULL
		  AND candidate."nextAttemptAt" <= transaction_timestamp()
		ORDER BY candidate."receivedAt" ASC, candidate.id ASC
		FOR UPDATE SKIP LOCKED
		LIMIT ?
	)
	RETURNING event.id, event.scope, event.context, event.attempts, event."receivedAt"`;

const COMPLETE_EVENT_SQL = `UPDATE "stripe_event"
	SET "processedAt" = transaction_timestamp(), "lastError" = NULL
	WHERE id = ?`;

const DEFER_EVENT_SQL = `UPDATE "stripe_event"
	SET "nextAttemptAt" = transaction_timestamp() + make_interval(secs => ?),
		"lastError" = ?
	WHERE id = ?`;

const DEAD_LETTER_EVENT_SQL = `UPDATE "stripe_event"
	SET "deadLetteredAt" = transaction_timestamp(), "lastError" = ?
	WHERE id = ?`;

@Injectable()
export class StripeEventProcessorService {
	private readonly logger = new Logger(StripeEventProcessorService.name);
	#running: Promise<void> | null = null;

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly handlers: StripeEventHandlerRegistry
	) {}

	processPending(): Promise<void> {
		this.#running ??= this.drain().finally(() => {
			this.#running = null;
		});
		return this.#running;
	}

	private async drain(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			for (;;) {
				const claimed = await this.claim();
				if (claimed.length === 0) return;
				for (const event of claimed) await this.processOne(event);
				if (claimed.length < STRIPE_EVENT_PROCESSING.batchSize) return;
			}
		});
	}

	private async claim(): Promise<ClaimedStripeEvent[]> {
		const claimed = await this.entityManager
			.fork()
			.execute<ClaimedStripeEvent[]>(CLAIM_EVENTS_SQL, [
				STRIPE_EVENT_PROCESSING.claimSeconds,
				STRIPE_EVENT_PROCESSING.batchSize,
			]);
		return claimed.sort(
			(left, right) =>
				parseDatabaseTimestamp(left.receivedAt).getTime() -
					parseDatabaseTimestamp(right.receivedAt).getTime() ||
				left.id.localeCompare(right.id)
		);
	}

	private async processOne(claimed: ClaimedStripeEvent): Promise<void> {
		const manager = this.entityManager.fork();
		try {
			const event = await this.stripe.v2.core.events.retrieve(
				claimed.id,
				{},
				claimed.context ? { stripeContext: claimed.context } : {}
			);
			if (!(await this.handlers.dispatch(event, claimed.scope))) {
				this.logger.warn(`Stripe event type ${event.type} is not handled`);
			}
			await manager.execute(COMPLETE_EVENT_SQL, [claimed.id]);
		} catch (error) {
			const message = stripeErrorDetails(error);
			if (claimed.attempts >= STRIPE_EVENT_PROCESSING.maximumAttempts) {
				this.logger.error(
					`Stripe event ${claimed.id} is dead-lettered after ${claimed.attempts} failed attempts: ${message}`
				);
				await manager.execute(DEAD_LETTER_EVENT_SQL, [message, claimed.id]);
				return;
			}
			this.logger.warn(
				`Stripe event ${claimed.id} attempt ${claimed.attempts} failed: ${message}`
			);
			await manager.execute(DEFER_EVENT_SQL, [
				stripeEventRetryDelaySeconds(claimed.attempts),
				message,
				claimed.id,
			]);
		}
	}
}
