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
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { TermsAcceptanceExempt } from '../../legal/decorators/terms-acceptance-exempt.decorator';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import {
	ListPaymentChannelsQueryDto,
	PaymentChannelDto,
	PaymentChannelPageDto,
	PendingVouchersDto,
} from '../dto/payment-channel.dto';
import {
	PaymentVoucherDto,
	SubmitVoucherSignatureDto,
} from '../dto/payment-voucher.dto';
import { PaymentChannelReadService } from '../services/channels/payment-channel-read.service';
import { SettlementPartyAccessService } from '../services/settlement-party-access.service';
import { VoucherSubmissionService } from '../services/vouchers/voucher-submission.service';

@Controller('settlement')
@ApiTags(OpenApiTag.SETTLEMENT)
@ApiBearerAuth()
export class PaymentChannelController {
	constructor(
		private readonly channels: PaymentChannelReadService,
		private readonly submissions: VoucherSubmissionService,
		private readonly partyAccess: SettlementPartyAccessService
	) {}

	@Get('channels')
	@ApiOperation({
		summary:
			'List the payment channels the active organization pays or is paid through, newest first, with their latest voucher',
		operationId: 'listPaymentChannels',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PaymentChannelPageDto })
	@RequiredAnyOrganizationPermissions({
		billing: ['read'],
		payouts: ['read'],
	})
	async listChannels(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListPaymentChannelsQueryDto
	): Promise<PaymentChannelPageDto> {
		return this.channels.list(
			authContext.organizationId,
			await this.partyAccess.readableParties(authContext, query.role),
			query
		);
	}

	@Get('channels/:paymentChannelId')
	@ApiOperation({
		summary: 'Get a payment channel with its latest voucher',
		operationId: 'getPaymentChannel',
	})
	@ApiParam({ name: 'paymentChannelId', format: 'uuid' })
	@ApiResponse({ status: HttpStatus.OK, type: PaymentChannelDto })
	@RequiredAnyOrganizationPermissions({
		billing: ['read'],
		payouts: ['read'],
	})
	async getChannel(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('paymentChannelId', ParseUUIDPipe) paymentChannelId: string
	): Promise<PaymentChannelDto> {
		return this.channels.get(
			authContext.organizationId,
			await this.partyAccess.readableParties(authContext),
			paymentChannelId
		);
	}

	@Get('vouchers/pending')
	@ApiOperation({
		summary:
			'List the vouchers waiting for a signature from the funding wallet or one of its signer keys',
		operationId: 'listPendingVouchers',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PendingVouchersDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	pendingVouchers(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<PendingVouchersDto> {
		return this.channels.pending(authContext.organizationId);
	}

	@Post('vouchers')
	@TermsAcceptanceExempt()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Submit the signature of a pending voucher',
		operationId: 'submitVoucherSignature',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PaymentVoucherDto })
	@ApiResponse({
		status: HttpStatus.UNPROCESSABLE_ENTITY,
		description:
			"The escrow would refuse the signature: wrong signer, a signer key whose scope does not cover the channel's host or fee, or its caps exceeded",
	})
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	submitVoucher(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: SubmitVoucherSignatureDto
	): Promise<PaymentVoucherDto> {
		return this.submissions.submit(authContext.organizationId, input);
	}
}
