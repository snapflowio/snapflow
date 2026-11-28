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
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';
import {
	PaymentChannelRefundDto,
	RecordPaymentChannelRefundDto,
	RefundDueDto,
} from '../dto/payment-channel-refund.dto';
import { PaymentChannelRefundService } from '../services/channels/payment-channel-refund.service';

@Controller('admin/refunds')
@ApiTags(OpenApiTag.ADMIN)
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
export class AdminPaymentChannelRefundController {
	constructor(private readonly refunds: PaymentChannelRefundService) {}

	@Get()
	@ApiOperation({
		summary:
			'List ended sandbox payment channels that owe their customer a refund',
		operationId: 'adminListRefundsDue',
	})
	@ApiResponse({ status: HttpStatus.OK, type: [RefundDueDto] })
	list(): Promise<RefundDueDto[]> {
		return this.refunds.due();
	}

	@Post(':paymentChannelId')
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary:
			'Record the fee wallet transaction that refunded what a payment channel owed its customer',
		operationId: 'adminRecordPaymentChannelRefund',
	})
	@ApiParam({ name: 'paymentChannelId', description: 'Payment channel ID' })
	@ApiResponse({ status: HttpStatus.CREATED, type: PaymentChannelRefundDto })
	@Audit({
		action: AuditAction.RECORD_REFUND,
		targetType: AuditTarget.PAYMENT_CHANNEL,
		targetIdFromRequest: (request: Request) => request.params.paymentChannelId,
		requestMetadata: {
			body: (request: TypedRequest<RecordPaymentChannelRefundDto>) => ({
				transactionHash: request.body?.transactionHash,
				dueMicroUsd: request.body?.dueMicroUsd,
			}),
		},
	})
	record(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('paymentChannelId', ParseUUIDPipe) paymentChannelId: string,
		@Body() input: RecordPaymentChannelRefundDto
	): Promise<PaymentChannelRefundDto> {
		return this.refunds.record(paymentChannelId, context.userId, input);
	}
}
