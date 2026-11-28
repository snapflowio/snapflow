/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { addSeconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Organization } from '../../organization/entities/organization.entity';
import {
	WEBHOOK_LIMITS,
	WEBHOOK_PROBLEM_CODE,
	WEBHOOK_SECRET_ROTATION_GRACE_SECONDS,
	WEBHOOK_SECRET_VERSION_INITIAL,
} from '../constants/webhook.constants';
import { WebhookDeliveryDto } from '../dto/webhook-delivery.dto';
import {
	type CreateWebhookEndpointDto,
	type UpdateWebhookEndpointDto,
	WebhookEndpointDto,
	type WebhookEndpointSecretDto,
} from '../dto/webhook-endpoint.dto';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookEndpoint } from '../entities/webhook-endpoint.entity';
import { WebhookMessage } from '../entities/webhook-message.entity';
import { WebhookAttemptTrigger } from '../enums/webhook-attempt-trigger.enum';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { WebhookEndpointDisabledReason } from '../enums/webhook-endpoint-disabled-reason.enum';
import { WebhookEventType } from '../enums/webhook-event-type.enum';
import { WebhookDestinationError } from '../utils/webhook-destination.util';
import { webhookPayload } from '../utils/webhook-publish.util';
import { WebhookHttpClientService } from './webhook-http-client.service';
import { WebhookSecretService } from './webhook-secret.service';

@Injectable()
export class WebhookEndpointService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly secrets: WebhookSecretService,
		private readonly http: WebhookHttpClientService
	) {}

	async list(
		organizationId: string,
		limit: number,
		cursor?: string
	): Promise<CursorPage<WebhookEndpointDto>> {
		const page = await findCursorPage(this.entityManager, WebhookEndpoint, {
			where: { organizationId },
			orderBy: { createdAt: 'DESC', id: 'DESC' },
			limit,
			cursor,
		});
		return { ...page, items: page.items.map(WebhookEndpointDto.from) };
	}

	async get(
		organizationId: string,
		endpointId: string
	): Promise<WebhookEndpointDto> {
		return WebhookEndpointDto.from(
			await this.requireEndpoint(this.entityManager, organizationId, endpointId)
		);
	}

	async create(
		organizationId: string,
		input: CreateWebhookEndpointDto
	): Promise<WebhookEndpointSecretDto> {
		const url = await this.validatedUrl(input.url);
		return this.entityManager.fork().transactional(async (manager) => {
			await manager.findOneOrFail(
				Organization,
				{ id: organizationId },
				{ fields: ['id'], lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			const existing = await manager.count(WebhookEndpoint, {
				organizationId,
			});
			if (existing >= WEBHOOK_LIMITS.ENDPOINTS_PER_ORGANIZATION) {
				throw new ConflictException({
					code: WEBHOOK_PROBLEM_CODE.ENDPOINT_LIMIT_REACHED,
					message: `An organization can have at most ${WEBHOOK_LIMITS.ENDPOINTS_PER_ORGANIZATION} webhook endpoints`,
				});
			}
			const now = await databaseNow(manager);
			const id = randomUUID();
			const secret = this.secrets.generate();
			const endpoint = manager.create(WebhookEndpoint, {
				id,
				organizationId,
				url,
				description: input.description?.trim() || null,
				eventTypes: input.eventTypes,
				enabled: true,
				disabledReason: null,
				disabledAt: null,
				disabledNoticeSentAt: null,
				failingSince: null,
				lastSucceededAt: null,
				secretVersion: WEBHOOK_SECRET_VERSION_INITIAL,
				encryptedSecret: this.secrets.encrypt(
					{ id, organizationId },
					WEBHOOK_SECRET_VERSION_INITIAL,
					secret
				),
				previousEncryptedSecret: null,
				previousSecretExpiresAt: null,
				createdAt: now,
				updatedAt: now,
			});
			await manager.flush();
			return { endpoint: WebhookEndpointDto.from(endpoint), secret };
		});
	}

	async update(
		organizationId: string,
		endpointId: string,
		input: UpdateWebhookEndpointDto
	): Promise<WebhookEndpointDto> {
		const url =
			input.url === undefined ? undefined : await this.validatedUrl(input.url);
		return this.entityManager.fork().transactional(async (manager) => {
			const endpoint = await this.requireEndpoint(
				manager,
				organizationId,
				endpointId
			);
			const now = await databaseNow(manager);
			if (url !== undefined) endpoint.url = url;
			if (input.description !== undefined) {
				endpoint.description = input.description.trim() || null;
			}
			if (input.eventTypes !== undefined)
				endpoint.eventTypes = input.eventTypes;
			if (input.enabled === true && !endpoint.enabled) {
				manager.assign(endpoint, {
					enabled: true,
					disabledReason: null,
					disabledAt: null,
					disabledNoticeSentAt: null,
					failingSince: null,
				});
			}
			if (input.enabled === false && endpoint.enabled) {
				manager.assign(endpoint, {
					enabled: false,
					disabledReason: WebhookEndpointDisabledReason.MANUAL,
					disabledAt: now,
				});
			}
			endpoint.updatedAt = now;
			return WebhookEndpointDto.from(endpoint);
		});
	}

	async delete(organizationId: string, endpointId: string): Promise<void> {
		const deleted = await this.entityManager
			.fork()
			.nativeDelete(WebhookEndpoint, { id: endpointId, organizationId });
		if (deleted === 0) throw this.endpointNotFound();
	}

	rotateSecret(
		organizationId: string,
		endpointId: string
	): Promise<WebhookEndpointSecretDto> {
		return this.entityManager.fork().transactional(async (manager) => {
			const endpoint = await this.requireEndpoint(
				manager,
				organizationId,
				endpointId,
				true
			);
			const now = await databaseNow(manager);
			const secret = this.secrets.generate();
			const version = endpoint.secretVersion + 1;
			manager.assign(endpoint, {
				previousEncryptedSecret: endpoint.encryptedSecret,
				previousSecretExpiresAt: addSeconds(
					now,
					WEBHOOK_SECRET_ROTATION_GRACE_SECONDS
				),
				secretVersion: version,
				encryptedSecret: this.secrets.encrypt(endpoint, version, secret),
				updatedAt: now,
			});
			return { endpoint: WebhookEndpointDto.from(endpoint), secret };
		});
	}

	sendTest(
		organizationId: string,
		endpointId: string
	): Promise<WebhookDeliveryDto> {
		return this.entityManager.fork().transactional(async (manager) => {
			const endpoint = await this.requireEndpoint(
				manager,
				organizationId,
				endpointId
			);
			if (!endpoint.enabled) {
				throw new ConflictException({
					code: WEBHOOK_PROBLEM_CODE.ENDPOINT_DISABLED,
					message: 'Enable the endpoint before sending a test event',
				});
			}
			const now = await databaseNow(manager);
			const messageId = randomUUID();
			const message = manager.create(WebhookMessage, {
				id: messageId,
				organizationId,
				eventType: WebhookEventType.WEBHOOK_TEST,
				payload: await webhookPayload(manager, {
					type: WebhookEventType.WEBHOOK_TEST,
					data: { endpointId },
				}),
				deduplicationKey: messageId,
				createdAt: now,
			});
			const delivery = manager.create(WebhookDelivery, {
				id: randomUUID(),
				organizationId,
				endpointId,
				messageId,
				status: WebhookDeliveryStatus.PENDING,
				attempts: 0,
				nextTrigger: WebhookAttemptTrigger.MANUAL,
				nextAttemptAt: now,
				lockId: null,
				lockedUntil: null,
				lastAttemptAt: null,
				lastResponseStatus: null,
				createdAt: now,
				updatedAt: now,
			});
			await manager.flush();
			return WebhookDeliveryDto.from(delivery, message);
		});
	}

	async requireEndpoint(
		manager: EntityManager,
		organizationId: string,
		endpointId: string,
		withSecret = false
	): Promise<WebhookEndpoint> {
		const endpoint = await manager.findOne(
			WebhookEndpoint,
			{ id: endpointId, organizationId },
			withSecret ? { populate: ['encryptedSecret'] } : {}
		);
		if (!endpoint) throw this.endpointNotFound();
		return endpoint;
	}

	private async validatedUrl(value: string): Promise<string> {
		try {
			return (await this.http.validateDestination(value)).toString();
		} catch (error) {
			if (error instanceof WebhookDestinationError) {
				throw new BadRequestException({
					code: WEBHOOK_PROBLEM_CODE.URL_REJECTED,
					message: error.message,
				});
			}
			throw error;
		}
	}

	private endpointNotFound(): NotFoundException {
		return new NotFoundException({
			code: WEBHOOK_PROBLEM_CODE.ENDPOINT_NOT_FOUND,
			message: 'Webhook endpoint not found',
		});
	}
}
