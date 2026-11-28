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
	HttpCode,
	HttpStatus,
	Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
	Audit,
	type TypedRequest,
} from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import {
	isOrganizationAuthContext,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { ACTIVE_ORGANIZATION_ROUTE } from '../constants/organization-routes.constants';
import { RequiredOrganizationPermissions } from '../decorators/required-organization-permissions.decorator';
import { OrganizationQuotaTierDto } from '../dto/organization-quota-tier.dto';
import {
	CreateQuotaIncreaseRequestDto,
	QuotaIncreaseRequestDto,
} from '../dto/quota-increase-request.dto';
import { OrganizationQuotaIncreaseRequestService } from '../services/organization-quota-increase-request.service';
import { OrganizationQuotaTierService } from '../services/organization-quota-tier.service';

const activeOrganizationId = (request: Request): string | null =>
	isOrganizationAuthContext(request.user) ? request.user.organizationId : null;

@Controller(ACTIVE_ORGANIZATION_ROUTE)
@ApiTags(OpenApiTag.ORGANIZATIONS)
export class OrganizationQuotaTierController {
	constructor(
		private readonly tiers: OrganizationQuotaTierService,
		private readonly requests: OrganizationQuotaIncreaseRequestService
	) {}

	@Get('quota-tier')
	@AllowAuthMethods([AuthMethod.SESSION, AuthMethod.API_KEY])
	@ApiOperation({
		summary:
			'Get the quota tier of the active organization, the tier ladder and its progress toward the next tier',
		operationId: 'getOrganizationQuotaTier',
	})
	@ApiResponse({ status: HttpStatus.OK, type: OrganizationQuotaTierDto })
	getQuotaTier(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<OrganizationQuotaTierDto> {
		return this.tiers.overview(authContext.organizationId);
	}

	@Get('quota-increase-requests')
	@AllowAuthMethods([AuthMethod.SESSION, AuthMethod.API_KEY])
	@ApiOperation({
		summary:
			'List the most recent requests for higher limits of the active organization',
		operationId: 'listOrganizationQuotaIncreaseRequests',
	})
	@ApiResponse({ status: HttpStatus.OK, type: [QuotaIncreaseRequestDto] })
	listQuotaIncreaseRequests(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<QuotaIncreaseRequestDto[]> {
		return this.requests.listForOrganization(authContext.organizationId);
	}

	@Post('quota-increase-requests')
	@HttpCode(HttpStatus.CREATED)
	@AllowAuthMethods([AuthMethod.SESSION])
	@RequiredOrganizationPermissions({ organization: ['update'] })
	@ApiOperation({
		summary: 'Request higher limits for the active organization',
		operationId: 'createOrganizationQuotaIncreaseRequest',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: QuotaIncreaseRequestDto })
	@Audit({
		action: AuditAction.REQUEST_QUOTA_INCREASE,
		targetType: AuditTarget.ORGANIZATION,
		targetIdFromRequest: activeOrganizationId,
		requestMetadata: {
			body: (request: TypedRequest<CreateQuotaIncreaseRequestDto>) => ({
				...request.body,
			}),
		},
	})
	createQuotaIncreaseRequest(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: CreateQuotaIncreaseRequestDto
	): Promise<QuotaIncreaseRequestDto> {
		return this.requests.create(
			authContext.organizationId,
			authContext.userId,
			input
		);
	}
}
