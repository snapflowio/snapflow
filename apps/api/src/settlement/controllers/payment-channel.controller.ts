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
	NotFoundException,
	Param,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Hex } from 'viem';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import { PaymentChannelErrorCode } from '../constants/payment-channel.constants';
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
import { VoucherDelegationDto } from '../dto/voucher-delegation.dto';
import { PaymentChannelReadService } from '../services/payment-channel-read.service';
import { SettlementPartyAccessService } from '../services/settlement-party-access.service';
import { VoucherDelegationService } from '../services/voucher-delegation.service';
import { VoucherSubmissionService } from '../services/voucher-submission.service';
import { parseChannelId } from '../utils/voucher-message.util';

// The escrow channels that pay for the organization's sandboxes or pay it as
// a host. API keys work here so an SDK or agent can sign client-mode
// vouchers.
@Controller('settlement')
@ApiTags('settlement')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class PaymentChannelController {
	constructor(
		private readonly channels: PaymentChannelReadService,
		private readonly submissions: VoucherSubmissionService,
		private readonly delegations: VoucherDelegationService,
		private readonly partyAccess: SettlementPartyAccessService
	) {}

	@Get('channels')
	@ApiOperation({
		summary:
			'List the payment channels of the active organization, newest first, with their latest voucher',
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

	@Get('channels/:channelId')
	@ApiOperation({
		summary: 'Get a payment channel with its latest voucher',
		operationId: 'getPaymentChannel',
	})
	@ApiParam({ name: 'channelId', description: 'The escrow channel id' })
	@ApiResponse({ status: HttpStatus.OK, type: PaymentChannelDto })
	@RequiredAnyOrganizationPermissions({
		billing: ['read'],
		payouts: ['read'],
	})
	async getChannel(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('channelId') channelId: string
	): Promise<PaymentChannelDto> {
		return this.channels.get(
			authContext.organizationId,
			await this.partyAccess.readableParties(authContext),
			requiredChannelId(channelId)
		);
	}

	@Get('vouchers/pending')
	@ApiOperation({
		summary:
			'List the vouchers waiting for a signature from the funding wallet or one of its session keys',
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
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Submit the signature of a pending voucher',
		operationId: 'submitVoucherSignature',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PaymentVoucherDto })
	@ApiResponse({
		status: HttpStatus.UNPROCESSABLE_ENTITY,
		description:
			'The escrow would refuse the signature: wrong signer, inactive session key or a cap exceeded',
	})
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	submitVoucher(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: SubmitVoucherSignatureDto
	): Promise<PaymentVoucherDto> {
		return this.submissions.submit(authContext.organizationId, input);
	}

	@Get('delegation')
	@ApiOperation({
		summary:
			"Get Snapflow's delegated voucher signer and session key caps that cover the running sandboxes",
		operationId: 'getVoucherDelegation',
	})
	@ApiResponse({ status: HttpStatus.OK, type: VoucherDelegationDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	delegation(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<VoucherDelegationDto> {
		return this.delegations.delegation(authContext.organizationId);
	}
}

function requiredChannelId(value: string): Hex {
	const channelId = parseChannelId(value);
	if (channelId === null) {
		throw new NotFoundException({
			code: PaymentChannelErrorCode.CHANNEL_NOT_FOUND,
			message: 'Payment channel not found',
		});
	}
	return channelId;
}
