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
	Get,
	Headers,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	Res,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiHeader,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Audit } from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import { CustomHeaders } from '../../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { CursorPageQueryDto } from '../../../common/dto/cursor-page.dto';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../../idempotency/request/services/api-idempotent-request.service';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import { TOP_UP_ROUTE } from '../constants/payments.constants';
import {
	CreateTopUpDto,
	TopUpDto,
	TopUpPageDto,
	TopUpSessionDto,
	UpdateTopUpAmountDto,
} from '../dto/top-up.dto';
import { TopUpService } from '../services/top-up.service';

const IDEMPOTENCY_REPLAYED = 'true';

@Controller(TOP_UP_ROUTE.CONTROLLER)
@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class TopUpController {
	constructor(
		private readonly topUps: TopUpService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Post()
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Start an embedded Checkout session that buys credit',
		operationId: 'createTopUp',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: TopUpSessionDto })
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.BILLING,
		targetIdFromResult: (result: TopUpSessionDto) => result.topUpId,
	})
	async createTopUp(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() input: CreateTopUpDto,
		@Res({ passthrough: true }) response: Response
	): Promise<TopUpSessionDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: TOP_UP_ROUTE.TEMPLATE,
				fingerprintInput: input,
			},
			async () => {
				const session = await this.topUps.create(
					{
						organizationId: authContext.organizationId,
						contactEmail: authContext.email,
					},
					input
				);
				return {
					body: session,
					status: HttpStatus.CREATED,
					resource: { type: AuditTarget.BILLING, id: session.topUpId },
					sensitive: true,
				};
			}
		);
		if (result.replayed) {
			response.setHeader(
				CustomHeaders.IDEMPOTENCY_REPLAYED.name,
				IDEMPOTENCY_REPLAYED
			);
		}
		return result.body;
	}

	@Put(':topUpId/amount')
	@ApiOperation({
		summary:
			'Change the amount of a top-up whose Checkout session is still open',
		operationId: 'updateTopUpAmount',
	})
	@ApiResponse({ status: HttpStatus.OK, type: TopUpDto })
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.BILLING,
		targetIdFromResult: (result: TopUpDto) => result.id,
	})
	updateTopUpAmount(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('topUpId', ParseUUIDPipe) topUpId: string,
		@Body() input: UpdateTopUpAmountDto
	): Promise<TopUpDto> {
		return this.topUps.updateAmount(authContext.organizationId, topUpId, input);
	}

	@Get()
	@ApiOperation({
		summary: 'List the top-ups of the active organization',
		operationId: 'listTopUps',
	})
	@ApiResponse({ status: HttpStatus.OK, type: TopUpPageDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	listTopUps(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: CursorPageQueryDto
	): Promise<TopUpPageDto> {
		return this.topUps.list(authContext.organizationId, query);
	}

	@Get(':topUpId')
	@ApiOperation({
		summary: 'Get a top-up, with the client secret while it requires action',
		operationId: 'getTopUp',
	})
	@ApiResponse({ status: HttpStatus.OK, type: TopUpDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	getTopUp(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('topUpId', ParseUUIDPipe) topUpId: string
	): Promise<TopUpDto> {
		return this.topUps.get(authContext.organizationId, topUpId);
	}
}
