/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import {
	MILLISECONDS_PER_SECOND,
	SECONDS_PER_DAY,
} from '../../common/constants/time.constants';
import { errorMessage, errorStack } from '../../common/utils/error/error.util';
import { addSeconds } from '../../common/utils/time.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import {
	WEBHOOK_CONTENT_TYPE,
	WEBHOOK_DISPATCH,
	WEBHOOK_HEADER,
	WEBHOOK_LIMITS,
	WEBHOOK_MAXIMUM_SCHEDULED_ATTEMPTS,
	WEBHOOK_RETRY_DELAYS_SECONDS,
	WEBHOOK_RETRY_JITTER_RATIO,
	WEBHOOK_SUCCESS_STATUS,
	WEBHOOK_USER_AGENT,
} from '../constants/webhook.constants';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookDeliveryAttempt } from '../entities/webhook-delivery-attempt.entity';
import { WebhookEndpoint } from '../entities/webhook-endpoint.entity';
import { WebhookMessage } from '../entities/webhook-message.entity';
import { WebhookAttemptTrigger } from '../enums/webhook-attempt-trigger.enum';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { WebhookEndpointDisabledReason } from '../enums/webhook-endpoint-disabled-reason.enum';
import { WebhookHttpClientService } from './webhook-http-client.service';
import { WebhookSecretService } from './webhook-secret.service';

const ENDPOINT_DISABLED_ERROR = 'The endpoint is disabled';

const CLAIM_SQL = `
	WITH candidates AS (
		SELECT id
		FROM webhook_delivery
		WHERE status = ?
		  AND "nextAttemptAt" <= transaction_timestamp()
		  AND ("lockedUntil" IS NULL OR "lockedUntil" <= transaction_timestamp())
		ORDER BY "nextAttemptAt" ASC, id ASC
		FOR UPDATE SKIP LOCKED
		LIMIT ?
	)
	UPDATE webhook_delivery AS delivery
	SET "lockId" = ?,
		"lockedUntil" = transaction_timestamp() + make_interval(secs => ?),
		"updatedAt" = transaction_timestamp()
	FROM candidates
	WHERE delivery.id = candidates.id
	RETURNING delivery.id`;

const RELEASE_AFTER_FAILURE_SQL = `
	UPDATE webhook_delivery
	SET "lockId" = NULL,
		"lockedUntil" = transaction_timestamp() + make_interval(secs => ?),
		"updatedAt" = transaction_timestamp()
	WHERE id = ? AND "lockId" = ?`;

const MARK_ENDPOINT_FAILING_SQL = `
	UPDATE webhook_endpoint
	SET "failingSince" = COALESCE("failingSince", ?),
		"updatedAt" = ?
	WHERE id = ?`;

const DISABLE_FAILING_ENDPOINT_SQL = `
	UPDATE webhook_endpoint
	SET enabled = false,
		"disabledReason" = ?,
		"disabledAt" = ?,
		"disabledNoticeSentAt" = NULL,
		"updatedAt" = ?
	WHERE id = ?
	  AND enabled
	  AND "failingSince" <= ?`;

interface AttemptOutcome {
	succeeded: boolean;
	responseStatus: number | null;
	responseBody: string | null;
	error: string | null;
	durationMilliseconds: number;
}

function isSuccessStatus(status: number): boolean {
	return (
		status >= WEBHOOK_SUCCESS_STATUS.MINIMUM &&
		status <= WEBHOOK_SUCCESS_STATUS.MAXIMUM
	);
}

@Injectable()
export class WebhookDispatcherService {
	private readonly logger = new Logger(WebhookDispatcherService.name);
	private readonly disableAfterSeconds: number;

	constructor(
		private readonly entityManager: EntityManager,
		private readonly http: WebhookHttpClientService,
		private readonly secrets: WebhookSecretService,
		config: TypedConfigService
	) {
		this.disableAfterSeconds =
			config.get('webhooks.disableAfterDays') * SECONDS_PER_DAY;
	}

	async dispatch(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const lockId = randomUUID();
			const claimed = await this.entityManager.execute<{ id: string }[]>(
				CLAIM_SQL,
				[
					WebhookDeliveryStatus.PENDING,
					WEBHOOK_DISPATCH.batchSize,
					lockId,
					this.http.leaseSeconds + WEBHOOK_DISPATCH.leaseMarginSeconds,
				]
			);
			await Promise.all(claimed.map(({ id }) => this.deliverOne(id, lockId)));
		});
	}

	private async deliverOne(deliveryId: string, lockId: string): Promise<void> {
		const manager = this.entityManager.fork();
		try {
			const delivery = await manager.findOne(WebhookDelivery, {
				id: deliveryId,
				lockId,
			});
			if (!delivery) return;
			const [endpoint, message] = await Promise.all([
				manager.findOneOrFail(
					WebhookEndpoint,
					{ id: delivery.endpointId },
					{ populate: ['encryptedSecret', 'previousEncryptedSecret'] }
				),
				manager.findOneOrFail(WebhookMessage, { id: delivery.messageId }),
			]);
			const outcome = endpoint.enabled
				? await this.attempt(manager, endpoint, message)
				: this.skipped();
			await this.record(manager, delivery, endpoint, lockId, outcome);
		} catch (error) {
			this.logger.error(
				`Webhook delivery ${deliveryId} could not be processed: ${errorMessage(error)}`,
				errorStack(error)
			);
			await manager.execute(RELEASE_AFTER_FAILURE_SQL, [
				WEBHOOK_DISPATCH.failureBackoffSeconds,
				deliveryId,
				lockId,
			]);
		}
	}

	private skipped(): AttemptOutcome {
		return {
			succeeded: false,
			responseStatus: null,
			responseBody: null,
			error: ENDPOINT_DISABLED_ERROR,
			durationMilliseconds: 0,
		};
	}

	private async attempt(
		manager: EntityManager,
		endpoint: WebhookEndpoint,
		message: WebhookMessage
	): Promise<AttemptOutcome> {
		const startedAt = performance.now();
		try {
			const body = JSON.stringify(message.payload);
			const timestamp = await databaseNow(manager);
			const headers = {
				[WEBHOOK_HEADER.ID]: message.id,
				[WEBHOOK_HEADER.TIMESTAMP]: String(
					Math.floor(timestamp.getTime() / MILLISECONDS_PER_SECOND)
				),
				[WEBHOOK_HEADER.SIGNATURE]: this.secrets.sign(endpoint, {
					messageId: message.id,
					timestamp,
					body,
				}),
				[WEBHOOK_HEADER.CONTENT_TYPE]: WEBHOOK_CONTENT_TYPE,
				[WEBHOOK_HEADER.USER_AGENT]: WEBHOOK_USER_AGENT,
			};
			const response = await this.http.post(endpoint.url, headers, body);
			return {
				succeeded: isSuccessStatus(response.status),
				responseStatus: response.status,
				responseBody: response.body,
				error: null,
				durationMilliseconds: Math.round(performance.now() - startedAt),
			};
		} catch (error) {
			return {
				succeeded: false,
				responseStatus: null,
				responseBody: null,
				error: errorMessage(error).slice(0, WEBHOOK_LIMITS.ERROR_MAX_LENGTH),
				durationMilliseconds: Math.round(performance.now() - startedAt),
			};
		}
	}

	private async record(
		manager: EntityManager,
		delivery: WebhookDelivery,
		endpoint: WebhookEndpoint,
		lockId: string,
		outcome: AttemptOutcome
	): Promise<void> {
		await manager.transactional(async (transaction) => {
			const now = await databaseNow(transaction);
			const attempts = delivery.attempts + 1;
			transaction.create(WebhookDeliveryAttempt, {
				id: randomUUID(),
				organizationId: delivery.organizationId,
				deliveryId: delivery.id,
				trigger: delivery.nextTrigger,
				...outcome,
				createdAt: now,
			});
			const retryDelay = outcome.succeeded
				? undefined
				: nextRetryDelay(endpoint.enabled, attempts);
			const leased = await transaction.nativeUpdate(
				WebhookDelivery,
				{ id: delivery.id, lockId },
				{
					status: deliveryStatus(outcome.succeeded, retryDelay),
					attempts,
					nextTrigger: WebhookAttemptTrigger.SCHEDULED,
					nextAttemptAt:
						retryDelay === undefined ? null : addSeconds(now, retryDelay),
					lastAttemptAt: now,
					lastResponseStatus: outcome.responseStatus,
					lockId: null,
					lockedUntil: null,
					updatedAt: now,
				}
			);
			if (leased === 0) {
				throw new Error(
					`Webhook delivery ${delivery.id} lost its lease before the attempt was recorded`
				);
			}
			if (endpoint.enabled) {
				await this.recordEndpointHealth(
					transaction,
					endpoint.id,
					outcome.succeeded,
					now
				);
			}
		});
	}

	private async recordEndpointHealth(
		transaction: EntityManager,
		endpointId: string,
		succeeded: boolean,
		now: Date
	): Promise<void> {
		if (succeeded) {
			await transaction.nativeUpdate(
				WebhookEndpoint,
				{ id: endpointId },
				{ failingSince: null, lastSucceededAt: now, updatedAt: now }
			);
			return;
		}
		await transaction.execute(MARK_ENDPOINT_FAILING_SQL, [
			now,
			now,
			endpointId,
		]);
		await transaction.execute(DISABLE_FAILING_ENDPOINT_SQL, [
			WebhookEndpointDisabledReason.FAILING,
			now,
			now,
			endpointId,
			addSeconds(now, -this.disableAfterSeconds),
		]);
	}
}

function nextRetryDelay(
	endpointEnabled: boolean,
	attempts: number
): number | undefined {
	const delay = WEBHOOK_RETRY_DELAYS_SECONDS[attempts - 1];
	if (
		!endpointEnabled ||
		attempts >= WEBHOOK_MAXIMUM_SCHEDULED_ATTEMPTS ||
		delay === undefined
	) {
		return undefined;
	}
	return Math.round(delay * (1 + Math.random() * WEBHOOK_RETRY_JITTER_RATIO));
}

function deliveryStatus(
	succeeded: boolean,
	retryDelay: number | undefined
): WebhookDeliveryStatus {
	if (succeeded) return WebhookDeliveryStatus.SUCCEEDED;
	return retryDelay === undefined
		? WebhookDeliveryStatus.FAILED
		: WebhookDeliveryStatus.PENDING;
}
