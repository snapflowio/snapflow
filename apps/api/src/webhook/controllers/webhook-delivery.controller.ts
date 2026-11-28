/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { ThrottlerScope } from '../../common/decorators/throttler-scope.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import {
	WebhookDeliveryAttemptDto,
	WebhookDeliveryDto,
	WebhookDeliveryPageDto,
	WebhookDeliveryQueryDto,
} from '../dto/webhook-delivery.dto';
import { WebhookDeliveryService } from '../services/webhook-delivery.service';

const ENDPOINT_ID_PARAM = 'endpointId';
const DELIVERY_ID_PARAM = 'deliveryId';

@Controller(`webhooks/endpoints/:${ENDPOINT_ID_PARAM}/deliveries`)
@ThrottlerScope(RateLimitThrottler.WEBHOOKS)
@ApiTags(OpenApiTag.WEBHOOKS)
@ApiBearerAuth()
export class WebhookDeliveryController {
	constructor(private readonly deliveries: WebhookDeliveryService) {}

	@Get()
	@ApiOperation({
		operationId: 'listWebhookDeliveries',
		summary: 'List deliveries to a webhook endpoint, newest first',
	})
	@ApiResponse({ status: HttpStatus.OK, type: WebhookDeliveryPageDto })
	@RequiredOrganizationPermissions({ webhooks: ['read'] })
	list(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param(ENDPOINT_ID_PARAM, ParseUUIDPipe) endpointId: string,
		@Query() query: WebhookDeliveryQueryDto
	): Promise<WebhookDeliveryPageDto> {
		return this.deliveries.list(context.organizationId, endpointId, query);
	}

	@Get(`:${DELIVERY_ID_PARAM}/attempts`)
	@ApiOperation({
		operationId: 'listWebhookDeliveryAttempts',
		summary: 'List the attempts of a webhook delivery, newest first',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: WebhookDeliveryAttemptDto,
		isArray: true,
	})
	@RequiredOrganizationPermissions({ webhooks: ['read'] })
	attempts(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param(ENDPOINT_ID_PARAM, ParseUUIDPipe) endpointId: string,
		@Param(DELIVERY_ID_PARAM, ParseUUIDPipe) deliveryId: string
	): Promise<WebhookDeliveryAttemptDto[]> {
		return this.deliveries.attempts(
			context.organizationId,
			endpointId,
			deliveryId
		);
	}

	@Post(`:${DELIVERY_ID_PARAM}/resend`)
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({
		operationId: 'resendWebhookDelivery',
		summary: 'Queue another attempt of a webhook delivery',
	})
	@ApiResponse({ status: HttpStatus.ACCEPTED, type: WebhookDeliveryDto })
	@RequiredOrganizationPermissions({ webhooks: ['write'] })
	@Audit({
		action: AuditAction.RESEND,
		targetType: AuditTarget.WEBHOOK_DELIVERY,
		targetIdFromRequest: (request) => request.params[DELIVERY_ID_PARAM],
	})
	resend(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param(ENDPOINT_ID_PARAM, ParseUUIDPipe) endpointId: string,
		@Param(DELIVERY_ID_PARAM, ParseUUIDPipe) deliveryId: string
	): Promise<WebhookDeliveryDto> {
		return this.deliveries.resend(
			context.organizationId,
			endpointId,
			deliveryId
		);
	}
}
