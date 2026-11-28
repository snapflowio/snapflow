/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Audit, TypedRequest } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { ThrottlerScope } from '../../common/decorators/throttler-scope.decorator';
import { CursorPageQueryDto } from '../../common/dto/cursor-page.dto';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { WebhookDeliveryDto } from '../dto/webhook-delivery.dto';
import {
	CreateWebhookEndpointDto,
	UpdateWebhookEndpointDto,
	WebhookEndpointDto,
	WebhookEndpointPageDto,
	WebhookEndpointSecretDto,
} from '../dto/webhook-endpoint.dto';
import { WebhookEndpointService } from '../services/webhook-endpoint.service';

const ENDPOINT_ID_PARAM = 'endpointId';

function endpointIdOf(request: Request): string | string[] | undefined {
	return request.params[ENDPOINT_ID_PARAM];
}

function endpointAuditBody(
	request: TypedRequest<Partial<CreateWebhookEndpointDto>>
) {
	return { url: request.body.url, eventTypes: request.body.eventTypes };
}

@Controller('webhooks/endpoints')
@ThrottlerScope(RateLimitThrottler.WEBHOOKS)
@ApiTags(OpenApiTag.WEBHOOKS)
@ApiBearerAuth()
export class WebhookEndpointController {
	constructor(private readonly endpoints: WebhookEndpointService) {}

	@Get()
	@ApiOperation({
		operationId: 'listWebhookEndpoints',
		summary: 'List webhook endpoints',
	})
	@ApiResponse({ status: HttpStatus.OK, type: WebhookEndpointPageDto })
	@RequiredOrganizationPermissions({ webhooks: ['read'] })
	list(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Query() query: CursorPageQueryDto
	): Promise<WebhookEndpointPageDto> {
		return this.endpoints.list(
			context.organizationId,
			query.limit,
			query.cursor
		);
	}

	@Get(`:${ENDPOINT_ID_PARAM}`)
	@ApiOperation({
		operationId: 'getWebhookEndpoint',
		summary: 'Get a webhook endpoint',
	})
	@ApiResponse({ status: HttpStatus.OK, type: WebhookEndpointDto })
	@RequiredOrganizationPermissions({ webhooks: ['read'] })
	get(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param(ENDPOINT_ID_PARAM, ParseUUIDPipe) endpointId: string
	): Promise<WebhookEndpointDto> {
		return this.endpoints.get(context.organizationId, endpointId);
	}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		operationId: 'createWebhookEndpoint',
		summary: 'Create a webhook endpoint and return its signing secret once',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: WebhookEndpointSecretDto })
	@RequiredOrganizationPermissions({ webhooks: ['write'] })
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.WEBHOOK_ENDPOINT,
		targetIdFromResult: (result: WebhookEndpointSecretDto) =>
			result.endpoint.id,
		requestMetadata: { body: endpointAuditBody },
	})
	create(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Body() input: CreateWebhookEndpointDto
	): Promise<WebhookEndpointSecretDto> {
		return this.endpoints.create(context.organizationId, input);
	}

	@Patch(`:${ENDPOINT_ID_PARAM}`)
	@ApiOperation({
		operationId: 'updateWebhookEndpoint',
		summary: 'Update, enable or disable a webhook endpoint',
	})
	@ApiResponse({ status: HttpStatus.OK, type: WebhookEndpointDto })
	@RequiredOrganizationPermissions({ webhooks: ['write'] })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.WEBHOOK_ENDPOINT,
		targetIdFromRequest: endpointIdOf,
		requestMetadata: { body: endpointAuditBody },
	})
	update(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param(ENDPOINT_ID_PARAM, ParseUUIDPipe) endpointId: string,
		@Body() input: UpdateWebhookEndpointDto
	): Promise<WebhookEndpointDto> {
		return this.endpoints.update(context.organizationId, endpointId, input);
	}

	@Delete(`:${ENDPOINT_ID_PARAM}`)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		operationId: 'deleteWebhookEndpoint',
		summary: 'Delete a webhook endpoint and its delivery log',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@RequiredOrganizationPermissions({ webhooks: ['delete'] })
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.WEBHOOK_ENDPOINT,
		targetIdFromRequest: endpointIdOf,
	})
	delete(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param(ENDPOINT_ID_PARAM, ParseUUIDPipe) endpointId: string
	): Promise<void> {
		return this.endpoints.delete(context.organizationId, endpointId);
	}

	@Post(`:${ENDPOINT_ID_PARAM}/secret/rotate`)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		operationId: 'rotateWebhookEndpointSecret',
		summary:
			'Rotate the signing secret; the previous secret keeps signing for 24 hours',
	})
	@ApiResponse({ status: HttpStatus.OK, type: WebhookEndpointSecretDto })
	@RequiredOrganizationPermissions({ webhooks: ['write'] })
	@Audit({
		action: AuditAction.ROTATE_SECRET,
		targetType: AuditTarget.WEBHOOK_ENDPOINT,
		targetIdFromRequest: endpointIdOf,
	})
	rotateSecret(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param(ENDPOINT_ID_PARAM, ParseUUIDPipe) endpointId: string
	): Promise<WebhookEndpointSecretDto> {
		return this.endpoints.rotateSecret(context.organizationId, endpointId);
	}

	@Post(`:${ENDPOINT_ID_PARAM}/test`)
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({
		operationId: 'sendWebhookTestEvent',
		summary: 'Queue a webhook.test event to this endpoint',
	})
	@ApiResponse({ status: HttpStatus.ACCEPTED, type: WebhookDeliveryDto })
	@RequiredOrganizationPermissions({ webhooks: ['write'] })
	@Audit({
		action: AuditAction.SEND_TEST,
		targetType: AuditTarget.WEBHOOK_ENDPOINT,
		targetIdFromRequest: endpointIdOf,
	})
	sendTest(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param(ENDPOINT_ID_PARAM, ParseUUIDPipe) endpointId: string
	): Promise<WebhookDeliveryDto> {
		return this.endpoints.sendTest(context.organizationId, endpointId);
	}
}
