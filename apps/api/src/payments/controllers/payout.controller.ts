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
import { Audit } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { RequireFreshSession } from '../../auth/decorators/require-fresh-session.decorator';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { HostEarningsDto } from '../dto/host-earnings.dto';
import { ListPayoutsQueryDto, PayoutPageDto } from '../dto/payout.dto';
import {
	CreatePayoutAccountDto,
	PayoutAccountDto,
	PayoutAccountSessionDto,
} from '../dto/payout-account.dto';
import { EarningsMaturityService } from '../services/earnings-maturity.service';
import { PaymentAccountService } from '../services/payment-account.service';
import { PayoutService } from '../services/payout.service';

@Controller('payouts')
@ApiTags('payouts')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@UseGuards(AuthenticatedRateLimitGuard)
export class PayoutController {
	constructor(
		private readonly accounts: PaymentAccountService,
		private readonly earnings: EarningsMaturityService,
		private readonly payouts: PayoutService
	) {}

	@Get('account')
	@ApiOperation({
		summary: 'Get the payout account of the active organization',
		operationId: 'getPayoutAccount',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PayoutAccountDto })
	@RequiredOrganizationPermissions({ payouts: ['read'] })
	async getPayoutAccount(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<PayoutAccountDto> {
		return PayoutAccountDto.from(
			await this.accounts.currentPayoutAccount(authContext.organizationId)
		);
	}

	@Post('account')
	@ApiOperation({
		summary: 'Create the Stripe payout account of the active organization',
		operationId: 'createPayoutAccount',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: PayoutAccountDto })
	@RequireFreshSession()
	@RequiredOrganizationPermissions({ payouts: ['manage'] })
	@Audit({ action: AuditAction.CREATE, targetType: AuditTarget.BILLING })
	async createPayoutAccount(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: CreatePayoutAccountDto
	): Promise<PayoutAccountDto> {
		return PayoutAccountDto.from(
			await this.accounts.ensureRecipient(
				{
					organizationId: authContext.organizationId,
					contactEmail: authContext.email,
				},
				input
			)
		);
	}

	@Post('account/session')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Create a session for the Connect onboarding and payout components',
		operationId: 'createPayoutAccountSession',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PayoutAccountSessionDto })
	@RequireFreshSession()
	@RequiredOrganizationPermissions({ payouts: ['manage'] })
	async createPayoutAccountSession(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<PayoutAccountSessionDto> {
		return {
			clientSecret: await this.accounts.createSession(
				authContext.organizationId
			),
		};
	}

	@Get('earnings')
	@ApiOperation({
		summary: 'Get the pending, available and maturing host earnings',
		operationId: 'getHostEarnings',
	})
	@ApiResponse({ status: HttpStatus.OK, type: HostEarningsDto })
	@RequiredOrganizationPermissions({ payouts: ['read'] })
	getHostEarnings(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<HostEarningsDto> {
		return this.earnings.hostEarnings(authContext.organizationId);
	}

	@Get()
	@ApiOperation({
		summary: 'List the payouts of the active organization',
		operationId: 'listPayouts',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PayoutPageDto })
	@RequiredOrganizationPermissions({ payouts: ['read'] })
	listPayouts(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListPayoutsQueryDto
	): Promise<PayoutPageDto> {
		return this.payouts.list(query, authContext.organizationId);
	}
}
