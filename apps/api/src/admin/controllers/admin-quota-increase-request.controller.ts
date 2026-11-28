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
	Param,
	ParseUUIDPipe,
	Post,
	Query,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
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
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import {
	AdminQuotaIncreaseRequestPageDto,
	ApproveQuotaIncreaseRequestDto,
	DenyQuotaIncreaseRequestDto,
	ListQuotaIncreaseRequestsQueryDto,
	QuotaIncreaseRequestDto,
} from '../../organization/dto/quota-increase-request.dto';
import { OrganizationQuotaIncreaseRequestService } from '../../organization/services/organization-quota-increase-request.service';
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';

const REQUEST_ID_PARAM = {
	name: 'requestId',
	description: 'Quota increase request ID',
} as const;

const REQUEST_TARGET = {
	targetType: AuditTarget.ORGANIZATION,
	targetIdFromRequest: (request: Request) => request.params.requestId,
} as const;

@Controller('admin/quota-increase-requests')
@ApiTags(OpenApiTag.ADMIN)
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
export class AdminQuotaIncreaseRequestController {
	constructor(
		private readonly requests: OrganizationQuotaIncreaseRequestService
	) {}

	@Get()
	@ApiOperation({
		summary: 'List requests for higher organization limits',
		operationId: 'adminListQuotaIncreaseRequests',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: AdminQuotaIncreaseRequestPageDto,
	})
	list(
		@Query() query: ListQuotaIncreaseRequestsQueryDto
	): Promise<AdminQuotaIncreaseRequestPageDto> {
		return this.requests.list(query);
	}

	@Post(':requestId/approval')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Approve a request for higher limits and raise the custom quota of its organization',
		operationId: 'adminApproveQuotaIncreaseRequest',
	})
	@ApiParam(REQUEST_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: QuotaIncreaseRequestDto })
	@Audit({
		action: AuditAction.APPROVE_QUOTA_INCREASE,
		...REQUEST_TARGET,
		requestMetadata: {
			body: (request: TypedRequest<ApproveQuotaIncreaseRequestDto>) => ({
				...request.body,
			}),
		},
	})
	approve(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('requestId', ParseUUIDPipe) requestId: string,
		@Body() input: ApproveQuotaIncreaseRequestDto
	): Promise<QuotaIncreaseRequestDto> {
		return this.requests.approve(requestId, context.userId, input);
	}

	@Post(':requestId/denial')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Deny a request for higher limits with a reason',
		operationId: 'adminDenyQuotaIncreaseRequest',
	})
	@ApiParam(REQUEST_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: QuotaIncreaseRequestDto })
	@Audit({
		action: AuditAction.DENY_QUOTA_INCREASE,
		...REQUEST_TARGET,
		requestMetadata: {
			body: (request: TypedRequest<DenyQuotaIncreaseRequestDto>) => ({
				...request.body,
			}),
		},
	})
	deny(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('requestId', ParseUUIDPipe) requestId: string,
		@Body() input: DenyQuotaIncreaseRequestDto
	): Promise<QuotaIncreaseRequestDto> {
		return this.requests.deny(requestId, context.userId, input);
	}
}
