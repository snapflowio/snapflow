/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import {
	ACTIVE_ORGANIZATION_ROUTE,
	ORGANIZATIONS_API_TAG,
} from '../constants/organization-routes.constants';
import { OrganizationLimitsDto } from '../dto/organization-limits.dto';
import { OrganizationQuotaDto } from '../dto/organization-quota.dto';
import { OrganizationUsageOverviewDto } from '../dto/organization-usage-overview.dto';
import { OrganizationLimitsService } from '../services/organization-limits.service';
import { OrganizationQuotaService } from '../services/organization-quota.service';
import { OrganizationUsageOverviewService } from '../services/organization-usage-overview.service';

@Controller(ACTIVE_ORGANIZATION_ROUTE)
@ApiTags(ORGANIZATIONS_API_TAG)
@AllowAuthMethods([AuthMethod.SESSION, AuthMethod.API_KEY])
@UseGuards(AuthenticatedRateLimitGuard)
export class OrganizationUsageController {
	constructor(
		private readonly limits: OrganizationLimitsService,
		private readonly quotas: OrganizationQuotaService,
		private readonly usageOverview: OrganizationUsageOverviewService
	) {}

	@Get('limits')
	@ApiOperation({
		summary: 'Get the limits of the active organization',
		operationId: 'getOrganizationLimits',
	})
	@ApiResponse({ status: HttpStatus.OK, type: OrganizationLimitsDto })
	async getLimits(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<OrganizationLimitsDto> {
		return OrganizationLimitsDto.from(
			await this.limits.get(authContext.organizationId)
		);
	}

	@Get('quotas')
	@ApiOperation({
		summary: 'List the quotas of the active organization',
		operationId: 'listOrganizationQuotas',
	})
	@ApiResponse({ status: HttpStatus.OK, type: [OrganizationQuotaDto] })
	listQuotas(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<OrganizationQuotaDto[]> {
		return this.quotas.list(authContext.organizationId);
	}

	@Get('usage')
	@ApiOperation({
		summary: 'Get the current usage overview of the active organization',
		operationId: 'getOrganizationUsageOverview',
	})
	@ApiResponse({ status: HttpStatus.OK, type: OrganizationUsageOverviewDto })
	getUsageOverview(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<OrganizationUsageOverviewDto> {
		return this.usageOverview.getUsageOverview(authContext.organizationId);
	}
}
