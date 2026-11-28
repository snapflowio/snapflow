/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { tenantScopedRelationKey } from '../../infra/database/utils/composite-relation-key.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { WEBHOOK_PROBLEM_CODE } from '../constants/webhook.constants';
import {
	WebhookDeliveryAttemptDto,
	WebhookDeliveryDto,
	type WebhookDeliveryQueryDto,
} from '../dto/webhook-delivery.dto';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookDeliveryAttempt } from '../entities/webhook-delivery-attempt.entity';
import { WebhookMessage } from '../entities/webhook-message.entity';
import { WebhookAttemptTrigger } from '../enums/webhook-attempt-trigger.enum';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { WebhookEndpointService } from './webhook-endpoint.service';

@Injectable()
export class WebhookDeliveryService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly endpoints: WebhookEndpointService
	) {}

	async list(
		organizationId: string,
		endpointId: string,
		query: WebhookDeliveryQueryDto
	): Promise<CursorPage<WebhookDeliveryDto>> {
		await this.endpoints.requireEndpoint(
			this.entityManager,
			organizationId,
			endpointId
		);
		const page = await findCursorPage(this.entityManager, WebhookDelivery, {
			where: {
				organizationId,
				endpointId: tenantScopedRelationKey(endpointId, organizationId),
				...(query.status ? { status: query.status } : {}),
			},
			orderBy: { createdAt: 'DESC', id: 'DESC' },
			limit: query.limit,
			cursor: query.cursor,
		});
		const messages = new Map(
			(
				await this.entityManager.find(WebhookMessage, {
					organizationId,
					id: { $in: page.items.map((delivery) => delivery.messageId) },
				})
			).map((message) => [message.id, message])
		);
		return {
			...page,
			items: page.items.flatMap((delivery) => {
				const message = messages.get(delivery.messageId);
				return message ? [WebhookDeliveryDto.from(delivery, message)] : [];
			}),
		};
	}

	async attempts(
		organizationId: string,
		endpointId: string,
		deliveryId: string
	): Promise<WebhookDeliveryAttemptDto[]> {
		await this.requireDelivery(
			this.entityManager,
			organizationId,
			endpointId,
			deliveryId
		);
		const attempts = await this.entityManager.find(
			WebhookDeliveryAttempt,
			{ organizationId, deliveryId },
			{ orderBy: { createdAt: 'DESC', id: 'DESC' } }
		);
		return attempts.map(WebhookDeliveryAttemptDto.from);
	}

	resend(
		organizationId: string,
		endpointId: string,
		deliveryId: string
	): Promise<WebhookDeliveryDto> {
		return this.entityManager.fork().transactional(async (manager) => {
			const delivery = await this.requireDelivery(
				manager,
				organizationId,
				endpointId,
				deliveryId,
				LockMode.PESSIMISTIC_WRITE
			);
			const now = await databaseNow(manager);
			if (delivery.lockedUntil && delivery.lockedUntil > now) {
				throw new ConflictException({
					code: WEBHOOK_PROBLEM_CODE.DELIVERY_IN_FLIGHT,
					message: 'This delivery is being attempted right now',
				});
			}
			manager.assign(delivery, {
				status: WebhookDeliveryStatus.PENDING,
				nextTrigger: WebhookAttemptTrigger.MANUAL,
				nextAttemptAt: now,
				updatedAt: now,
			});
			const message = await manager.findOneOrFail(WebhookMessage, {
				id: delivery.messageId,
				organizationId,
			});
			return WebhookDeliveryDto.from(delivery, message);
		});
	}

	private async requireDelivery(
		manager: EntityManager,
		organizationId: string,
		endpointId: string,
		deliveryId: string,
		lockMode?: LockMode.PESSIMISTIC_WRITE
	): Promise<WebhookDelivery> {
		const delivery = await manager.findOne(
			WebhookDelivery,
			{
				id: deliveryId,
				organizationId,
				endpointId: tenantScopedRelationKey(endpointId, organizationId),
			},
			lockMode ? { lockMode } : {}
		);
		if (!delivery) {
			throw new NotFoundException({
				code: WEBHOOK_PROBLEM_CODE.DELIVERY_NOT_FOUND,
				message: 'Webhook delivery not found',
			});
		}
		return delivery;
	}
}
