/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	ArrayNotEmpty,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsIn,
	IsOptional,
	IsString,
	IsUrl,
	MaxLength,
} from 'class-validator';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import { WEBHOOK_LIMITS } from '../constants/webhook.constants';
import type { WebhookEndpoint } from '../entities/webhook-endpoint.entity';
import { WebhookEndpointDisabledReason } from '../enums/webhook-endpoint-disabled-reason.enum';
import {
	SUBSCRIBABLE_WEBHOOK_EVENT_TYPES,
	type SubscribableWebhookEventType,
} from '../enums/webhook-event-type.enum';

const SUBSCRIBABLE_EVENT_TYPE_SCHEMA = {
	enum: SUBSCRIBABLE_WEBHOOK_EVENT_TYPES,
	enumName: 'WebhookSubscribableEventType',
	isArray: true,
} as const;

const URL_OPTIONS = { require_tld: false, require_protocol: true } as const;

@ApiSchema({ name: 'CreateWebhookEndpoint' })
export class CreateWebhookEndpointDto {
	@ApiProperty({ example: 'https://example.com/webhooks/snapflow' })
	@IsUrl(URL_OPTIONS)
	@MaxLength(WEBHOOK_LIMITS.URL_MAX_LENGTH)
	url: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(WEBHOOK_LIMITS.DESCRIPTION_MAX_LENGTH)
	description?: string;

	@ApiProperty(SUBSCRIBABLE_EVENT_TYPE_SCHEMA)
	@IsArray()
	@ArrayNotEmpty()
	@ArrayUnique()
	@IsIn(SUBSCRIBABLE_WEBHOOK_EVENT_TYPES, { each: true })
	eventTypes: SubscribableWebhookEventType[];
}

@ApiSchema({ name: 'UpdateWebhookEndpoint' })
export class UpdateWebhookEndpointDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsUrl(URL_OPTIONS)
	@MaxLength(WEBHOOK_LIMITS.URL_MAX_LENGTH)
	url?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(WEBHOOK_LIMITS.DESCRIPTION_MAX_LENGTH)
	description?: string;

	@ApiPropertyOptional(SUBSCRIBABLE_EVENT_TYPE_SCHEMA)
	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@ArrayUnique()
	@IsIn(SUBSCRIBABLE_WEBHOOK_EVENT_TYPES, { each: true })
	eventTypes?: SubscribableWebhookEventType[];

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;
}

@ApiSchema({ name: 'WebhookEndpoint' })
export class WebhookEndpointDto {
	@ApiProperty() id: string;
	@ApiProperty() url: string;
	@ApiProperty({ type: String, nullable: true }) description: string | null;
	@ApiProperty(SUBSCRIBABLE_EVENT_TYPE_SCHEMA)
	eventTypes: SubscribableWebhookEventType[];
	@ApiProperty() enabled: boolean;
	@ApiProperty({
		enum: WebhookEndpointDisabledReason,
		enumName: 'WebhookEndpointDisabledReason',
		nullable: true,
	})
	disabledReason: WebhookEndpointDisabledReason | null;
	@ApiProperty({ type: Date, nullable: true }) disabledAt: Date | null;
	@ApiProperty({ type: Date, nullable: true }) failingSince: Date | null;
	@ApiProperty({ type: Date, nullable: true }) lastSucceededAt: Date | null;
	@ApiProperty({ type: Date, nullable: true })
	previousSecretExpiresAt: Date | null;
	@ApiProperty() createdAt: Date;
	@ApiProperty() updatedAt: Date;

	static from(entity: WebhookEndpoint): WebhookEndpointDto {
		return {
			id: entity.id,
			url: entity.url,
			description: entity.description,
			eventTypes: entity.eventTypes,
			enabled: entity.enabled,
			disabledReason: entity.disabledReason,
			disabledAt: entity.disabledAt,
			failingSince: entity.failingSince,
			lastSucceededAt: entity.lastSucceededAt,
			previousSecretExpiresAt: entity.previousSecretExpiresAt,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt,
		};
	}
}

@ApiSchema({ name: 'WebhookEndpointSecret' })
export class WebhookEndpointSecretDto {
	@ApiProperty({ type: WebhookEndpointDto }) endpoint: WebhookEndpointDto;

	@ApiProperty({
		description:
			'Standard Webhooks signing secret (whsec_ prefix). It is only returned once.',
	})
	secret: string;
}

@ApiSchema({ name: 'WebhookEndpointPage' })
export class WebhookEndpointPageDto extends CursorPageDto<WebhookEndpointDto> {
	@ApiProperty({ type: WebhookEndpointDto, isArray: true })
	declare items: WebhookEndpointDto[];
}
