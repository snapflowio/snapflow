/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Audit } from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../../auth/decorators/allow-auth-methods.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import { RequiredSystemRole } from '../../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../../user/enums/system-role.enum';
import {
	AdminPaymentAccountDto,
	AdminPaymentDisputePageDto,
	ListAdminPaymentDisputesQueryDto,
} from '../dto/admin-payment.dto';
import {
	ListPayoutsQueryDto,
	PayoutDto,
	PayoutPageDto,
} from '../dto/payout.dto';
import { AdminPaymentService } from '../services/admin-payment.service';
import { PayoutService } from '../services/payout.service';

@Controller('admin')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminPaymentController {
	constructor(
		private readonly payouts: PayoutService,
		private readonly payments: AdminPaymentService
	) {}

	@Get('payouts')
	@ApiOperation({
		summary: 'List host payouts',
		operationId: 'listAdminPayouts',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PayoutPageDto })
	listAdminPayouts(
		@Query() query: ListPayoutsQueryDto
	): Promise<PayoutPageDto> {
		return this.payouts.list(query);
	}

	@Post('payouts/:payoutId/retry')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Retry the Stripe transfer of a pending payout',
		operationId: 'retryAdminPayout',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PayoutDto })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.BILLING,
		targetIdFromRequest: (request) => request.params.payoutId,
	})
	async retryAdminPayout(
		@Param('payoutId', ParseUUIDPipe) payoutId: string
	): Promise<PayoutDto> {
		return PayoutDto.from(await this.payouts.retry(payoutId));
	}

	@Get('payments/disputes')
	@ApiOperation({
		summary: 'List payment disputes',
		operationId: 'listAdminDisputes',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AdminPaymentDisputePageDto })
	listAdminDisputes(
		@Query() query: ListAdminPaymentDisputesQueryDto
	): Promise<AdminPaymentDisputePageDto> {
		return this.payments.listDisputes(query);
	}

	@Get('organizations/:organizationId/payment-account')
	@ApiOperation({
		summary: 'Get the Stripe payment account of an organization',
		operationId: 'getAdminPaymentAccount',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AdminPaymentAccountDto })
	async getAdminPaymentAccount(
		@Param('organizationId', ParseUUIDPipe) organizationId: string
	): Promise<AdminPaymentAccountDto> {
		return AdminPaymentAccountDto.from(
			await this.payments.account(organizationId)
		);
	}
}
