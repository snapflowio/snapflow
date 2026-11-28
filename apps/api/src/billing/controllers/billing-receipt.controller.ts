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
	StreamableFile,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiProduces,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { ThrottlerScope } from '../../common/decorators/throttler-scope.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import {
	RECEIPT_DOCUMENT_CONTENT_TYPE,
	ReceiptDocumentFormat,
} from '../constants/billing-receipt.constants';
import {
	BillingReceiptDocumentParamsDto,
	BillingReceiptDto,
	BillingReceiptSummaryDto,
	IssueBillingReceiptDto,
} from '../dto/billing-receipt.dto';
import { BillingReceiptService } from '../services/billing-receipt.service';

@Controller('billing/receipts')
@ApiTags(OpenApiTag.BILLING)
@ApiBearerAuth()
export class BillingReceiptController {
	constructor(private readonly receipts: BillingReceiptService) {}

	@Get()
	@ApiOperation({
		summary: 'List the receipts issued to the active organization',
		operationId: 'listBillingReceipts',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: BillingReceiptSummaryDto,
		isArray: true,
	})
	@RequiredOrganizationPermissions({ billing: ['read'] })
	listBillingReceipts(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<BillingReceiptSummaryDto[]> {
		return this.receipts.list(authContext.organizationId);
	}

	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			"Issue the receipt for a closed month, or return it if it was already issued; it freezes the month's charges and the billing details as they are now",
		operationId: 'issueBillingReceipt',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingReceiptDto })
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'The month has not ended (code billing_receipt_month_open) or the organization has no billing details (code billing_profile_required)',
	})
	@RequiredOrganizationPermissions({ billing: ['read'] })
	issueBillingReceipt(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: IssueBillingReceiptDto
	): Promise<BillingReceiptDto> {
		return this.receipts.issue(authContext.organizationId, input.month);
	}

	@Get(':receiptId')
	@ApiOperation({
		summary: 'Get an issued receipt',
		operationId: 'getBillingReceipt',
	})
	@ApiParam({ name: 'receiptId', format: 'uuid' })
	@ApiResponse({ status: HttpStatus.OK, type: BillingReceiptDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	getBillingReceipt(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('receiptId', ParseUUIDPipe) receiptId: string
	): Promise<BillingReceiptDto> {
		return this.receipts.get(authContext.organizationId, receiptId);
	}

	@Get(':receiptId/:format')
	@ThrottlerScope(RateLimitThrottler.BILLING_DOCUMENTS)
	@ApiOperation({
		summary: 'Download an issued receipt as a PDF or a CSV',
		operationId: 'downloadBillingReceipt',
	})
	@ApiParam({ name: 'receiptId', format: 'uuid' })
	@ApiParam({ name: 'format', enum: Object.values(ReceiptDocumentFormat) })
	@ApiProduces(...Object.values(RECEIPT_DOCUMENT_CONTENT_TYPE))
	@ApiResponse({
		status: HttpStatus.OK,
		schema: { type: 'string', format: 'binary' },
	})
	@RequiredOrganizationPermissions({ billing: ['read'] })
	async downloadBillingReceipt(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param() params: BillingReceiptDocumentParamsDto
	): Promise<StreamableFile> {
		const document = await this.receipts.document(
			authContext.organizationId,
			params.receiptId,
			params.format
		);
		return new StreamableFile(document.body, {
			type: document.contentType,
			disposition: `attachment; filename="${document.filename}"`,
		});
	}
}
