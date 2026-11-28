/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import type { WebhookDelivery } from '../entities/webhook-delivery.entity';
import type { WebhookDeliveryAttempt } from '../entities/webhook-delivery-attempt.entity';
import type { WebhookMessage } from '../entities/webhook-message.entity';
import { WebhookAttemptTrigger } from '../enums/webhook-attempt-trigger.enum';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { WebhookEventType } from '../enums/webhook-event-type.enum';
import type { WebhookPayload } from '../types/webhook-payload.types';

const DELIVERY_STATUS_SCHEMA = {
	enum: WebhookDeliveryStatus,
	enumName: 'WebhookDeliveryStatus',
} as const;

@ApiSchema({ name: 'WebhookDeliveryQuery' })
export class WebhookDeliveryQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional(DELIVERY_STATUS_SCHEMA)
	@IsOptional()
	@IsEnum(WebhookDeliveryStatus)
	status?: WebhookDeliveryStatus;
}

@ApiSchema({ name: 'WebhookDelivery' })
export class WebhookDeliveryDto {
	@ApiProperty() id: string;
	@ApiProperty() endpointId: string;
	@ApiProperty({ description: 'Value of the webhook-id header' })
	messageId: string;
	@ApiProperty({ enum: WebhookEventType, enumName: 'WebhookEventType' })
	eventType: WebhookEventType;
	@ApiProperty({ type: 'object', additionalProperties: true })
	payload: WebhookPayload;
	@ApiProperty(DELIVERY_STATUS_SCHEMA) status: WebhookDeliveryStatus;
	@ApiProperty() attempts: number;
	@ApiProperty({ type: Date, nullable: true }) nextAttemptAt: Date | null;
	@ApiProperty({ type: Date, nullable: true }) lastAttemptAt: Date | null;
	@ApiProperty({ type: Number, nullable: true })
	lastResponseStatus: number | null;
	@ApiProperty() createdAt: Date;

	static from(
		delivery: WebhookDelivery,
		message: WebhookMessage
	): WebhookDeliveryDto {
		return {
			id: delivery.id,
			endpointId: delivery.endpointId,
			messageId: message.id,
			eventType: message.eventType,
			payload: message.payload,
			status: delivery.status,
			attempts: delivery.attempts,
			nextAttemptAt: delivery.nextAttemptAt,
			lastAttemptAt: delivery.lastAttemptAt,
			lastResponseStatus: delivery.lastResponseStatus,
			createdAt: delivery.createdAt,
		};
	}
}

@ApiSchema({ name: 'WebhookDeliveryPage' })
export class WebhookDeliveryPageDto extends CursorPageDto<WebhookDeliveryDto> {
	@ApiProperty({ type: WebhookDeliveryDto, isArray: true })
	declare items: WebhookDeliveryDto[];
}

@ApiSchema({ name: 'WebhookDeliveryAttempt' })
export class WebhookDeliveryAttemptDto {
	@ApiProperty() id: string;
	@ApiProperty({
		enum: WebhookAttemptTrigger,
		enumName: 'WebhookAttemptTrigger',
	})
	trigger: WebhookAttemptTrigger;
	@ApiProperty() succeeded: boolean;
	@ApiProperty({ type: Number, nullable: true }) responseStatus: number | null;
	@ApiProperty({
		type: String,
		nullable: true,
		description: 'Response body truncated to the first 4 KiB',
	})
	responseBody: string | null;
	@ApiProperty({ type: String, nullable: true }) error: string | null;
	@ApiProperty() durationMilliseconds: number;
	@ApiProperty() createdAt: Date;

	static from(entity: WebhookDeliveryAttempt): WebhookDeliveryAttemptDto {
		return {
			id: entity.id,
			trigger: entity.trigger,
			succeeded: entity.succeeded,
			responseStatus: entity.responseStatus,
			responseBody: entity.responseBody,
			error: entity.error,
			durationMilliseconds: entity.durationMilliseconds,
			createdAt: entity.createdAt,
		};
	}
}
