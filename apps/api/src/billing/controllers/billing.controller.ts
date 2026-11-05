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
	ConflictException,
	Controller,
	Get,
	Headers,
	HttpStatus,
	Param,
	Put,
	Query,
	Res,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiProduces,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Audit } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import {
	BILLING_EXPORT_SCHEMA_VERSION,
	BillingExportFormat,
} from '../constants/billing.constants';
import { BillingBudgetErrorCode } from '../constants/billing-admission.constants';
import {
	BillingBudgetDto,
	BillingLineItemDto,
	BillingLineItemPageDto,
	BillingOverviewDto,
	BillingSandboxUsageDto,
	BillingSandboxUsagePageDto,
	ExportBillingQueryDto,
	ListBillingSandboxUsageQueryDto,
	ListBillingUsageQueryDto,
	SandboxBillingSummaryDto,
	UpdateBillingBudgetDto,
} from '../dto/billing.dto';
import { BillingConfigDto } from '../dto/billing-config.dto';
import { BillingBudgetService } from '../services/billing-budget.service';
import { BillingConfigService } from '../services/billing-config.service';
import { BillingLineQueryService } from '../services/billing-line-query.service';
import { BillingOverviewService } from '../services/billing-overview.service';
import {
	billingExportCsv,
	billingExportRow,
} from '../utils/billing-export.util';

@Controller('billing')
@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class BillingController {
	constructor(
		private readonly overviews: BillingOverviewService,
		private readonly lineQueries: BillingLineQueryService,
		private readonly budgets: BillingBudgetService,
		private readonly config: BillingConfigService
	) {}

	@Get('config')
	@ApiOperation({
		summary: 'Get the customer-facing billing configuration',
		operationId: 'getBillingConfig',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingConfigDto })
	@RequiredAnyOrganizationPermissions({
		billing: ['read'],
		payouts: ['read'],
	})
	billingConfig(): Promise<BillingConfigDto> {
		return this.config.get();
	}

	@Get('overview')
	@ApiOperation({
		summary: 'Get the consistent billing overview of the active organization',
		operationId: 'getBillingOverview',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingOverviewDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	overview(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<BillingOverviewDto> {
		return this.overviews.overview(authContext.organizationId);
	}

	@Get('usage')
	@ApiOperation({
		summary: 'List canonical billing line items',
		operationId: 'listBillingUsage',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingLineItemPageDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	usage(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListBillingUsageQueryDto
	): Promise<BillingLineItemPageDto> {
		return this.lineQueries.usage(authContext.organizationId, query);
	}

	@Get('usage/sandboxes')
	@ApiOperation({
		summary: 'List billing usage aggregated per sandbox',
		operationId: 'listBillingSandboxUsage',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingSandboxUsagePageDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	sandboxUsage(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListBillingSandboxUsageQueryDto
	): Promise<BillingSandboxUsagePageDto> {
		return this.lineQueries.sandboxUsage(authContext.organizationId, query);
	}

	@Get('usage/sandboxes/:sandboxId')
	@ApiOperation({
		summary: 'Get the billing usage of one sandbox',
		operationId: 'getBillingSandboxUsage',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingSandboxUsageDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	sandboxUsageSummary(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string
	): Promise<BillingSandboxUsageDto> {
		return this.lineQueries.sandboxUsageSummary(
			authContext.organizationId,
			sandboxId
		);
	}

	@Get('sandboxes/:sandboxId')
	@ApiOperation({
		summary: 'Get immutable placement pricing and live sandbox accrual',
		operationId: 'getSandboxBillingSummary',
	})
	@ApiResponse({ status: HttpStatus.OK, type: SandboxBillingSummaryDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	sandboxSummary(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string
	): Promise<SandboxBillingSummaryDto> {
		return this.lineQueries.sandboxSummary(
			authContext.organizationId,
			sandboxId
		);
	}

	@Get('usage/export')
	@ApiOperation({
		summary: 'Export canonical billing lines',
		operationId: 'exportBillingUsage',
	})
	@ApiProduces('text/csv', 'application/json')
	@ApiResponse({ status: HttpStatus.OK, schema: { type: 'string' } })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	async exportUsage(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ExportBillingQueryDto,
		@Res({ passthrough: true }) response: Response
	): Promise<string> {
		const lines = await this.lineQueries.exportUsage(
			authContext.organizationId,
			query
		);
		const rows = lines.map(billingExportRow);
		const json = query.format === BillingExportFormat.JSON;
		response.type(json ? 'application/json' : 'text/csv');
		response.attachment(`snapflow-billing-usage.${query.format}`);
		return json
			? JSON.stringify({
					schemaVersion: BILLING_EXPORT_SCHEMA_VERSION,
					items: rows,
				})
			: billingExportCsv(rows);
	}

	@Get('usage/:lineItemId')
	@ApiOperation({
		summary: 'Get a canonical billing line item',
		operationId: 'getBillingLineItem',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingLineItemDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	line(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('lineItemId') lineItemId: string
	): Promise<BillingLineItemDto> {
		return this.lineQueries.line(authContext.organizationId, lineItemId);
	}

	@Get('budget')
	@ApiOperation({
		summary: 'Get the billing budget of the active organization',
		operationId: 'getBillingBudget',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingBudgetDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	budget(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<BillingBudgetDto> {
		return this.budgets.find(authContext.organizationId);
	}

	@Put('budget')
	@ApiOperation({
		summary: 'Create or replace the billing budget of the active organization',
		operationId: 'updateBillingBudget',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingBudgetDto })
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	@Audit({ action: AuditAction.UPDATE, targetType: AuditTarget.BILLING })
	@AllowAuthMethods([AuthMethod.SESSION])
	updateBudget(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Headers('if-match') ifMatch: string | undefined,
		@Body() input: UpdateBillingBudgetDto
	): Promise<BillingBudgetDto> {
		return this.budgets.update(
			authContext,
			parseResourceVersion(ifMatch),
			input
		);
	}
}

function parseResourceVersion(value: string | undefined): number {
	const match = /^"?(\d+)"?$/.exec(value ?? '');
	if (!match)
		throw new ConflictException({
			code: BillingBudgetErrorCode.IF_MATCH_REQUIRED,
		});
	return Number.parseInt(match[1], 10);
}
