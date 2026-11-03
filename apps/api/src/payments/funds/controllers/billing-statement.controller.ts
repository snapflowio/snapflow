/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus, Param, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import {
	BillingStatementDto,
	BillingStatementSummaryDto,
} from '../dto/billing-statement.dto';
import { BillingStatementService } from '../services/billing-statement.service';

@Controller('billing/statements')
@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class BillingStatementController {
	constructor(private readonly statements: BillingStatementService) {}

	@Get()
	@ApiOperation({
		summary: 'List the monthly statements of the active organization',
		operationId: 'listBillingStatements',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: BillingStatementSummaryDto,
		isArray: true,
	})
	@RequiredOrganizationPermissions({ billing: ['read'] })
	listBillingStatements(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<BillingStatementSummaryDto[]> {
		return this.statements.list(authContext.organizationId);
	}

	@Get(':month')
	@ApiOperation({
		summary: 'Get the monthly statement derived from the ledger',
		operationId: 'getBillingStatement',
	})
	@ApiParam({
		name: 'month',
		description: 'Month as YYYY-MM',
		example: '2026-10',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingStatementDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	getBillingStatement(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('month') month: string
	): Promise<BillingStatementDto> {
		return this.statements.get(authContext.organizationId, month);
	}
}
