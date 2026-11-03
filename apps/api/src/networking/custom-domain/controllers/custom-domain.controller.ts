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
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
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
import { CustomHeaders } from '../../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { CursorPageQueryDto } from '../../../common/dto/cursor-page.dto';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../../idempotency/request/services/api-idempotent-request.service';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import {
	CreateCustomDomainDto,
	CustomDomainDto,
	CustomDomainPageDto,
} from '../dto/custom-domain.dto';
import { CustomDomainService } from '../services/custom-domain.service';

@Controller('sandbox/:sandboxId/exposures/:exposureId/custom-domains')
@ApiTags('custom domains')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class CustomDomainController {
	constructor(
		private readonly domains: CustomDomainService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Post()
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@ApiOperation({
		summary: 'Create a Cloudflare-backed custom domain',
		operationId: 'createCustomDomain',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: CustomDomainDto })
	async create(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Param('exposureId', ParseUUIDPipe) exposureId: string,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() input: CreateCustomDomainDto,
		@Res({ passthrough: true }) response: Response
	): Promise<CustomDomainDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate:
					'/sandbox/:sandboxId/exposures/:exposureId/custom-domains',
				fingerprintInput: { sandboxId, exposureId, ...input },
			},
			async (manager) => {
				const body = await this.domains.create(
					authContext.organizationId,
					sandboxId,
					exposureId,
					input,
					manager
				);
				return {
					body,
					status: HttpStatus.CREATED,
					resource: { type: 'custom_domain', id: body.id },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		}
		return result.body;
	}

	@Get()
	@ApiOperation({
		summary: 'List custom domains for an exposure',
		operationId: 'listCustomDomains',
	})
	@ApiResponse({ status: HttpStatus.OK, type: CustomDomainPageDto })
	list(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Param('exposureId', ParseUUIDPipe) exposureId: string,
		@Query() query: CursorPageQueryDto
	): Promise<CustomDomainPageDto> {
		return this.domains.list(
			authContext.organizationId,
			sandboxId,
			exposureId,
			query.limit,
			query.cursor
		);
	}

	@Delete(':domainId')
	@HttpCode(HttpStatus.ACCEPTED)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@ApiOperation({
		summary: 'Delete a custom domain',
		operationId: 'deleteCustomDomain',
	})
	remove(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Param('exposureId', ParseUUIDPipe) exposureId: string,
		@Param('domainId', ParseUUIDPipe) domainId: string
	): Promise<void> {
		return this.domains.remove(
			authContext.organizationId,
			sandboxId,
			exposureId,
			domainId
		);
	}
}
