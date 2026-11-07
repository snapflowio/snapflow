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
	HttpCode,
	HttpStatus,
	Param,
	ParseEnumPipe,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { RequireFreshSession } from '../../auth/decorators/require-fresh-session.decorator';
import { OrganizationAccessService } from '../../auth/services/organization-access.service';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredAnyOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { PAYMENT_WALLET_MANAGE_PERMISSION } from '../constants/payment-wallet.constants';
import {
	CreateWalletChallengeDto,
	LinkPaymentWalletDto,
	PaymentWalletDto,
	WalletChallengeDto,
} from '../dto/payment-wallet.dto';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { PaymentWalletService } from '../services/payment-wallet.service';
import { WalletChallengeService } from '../services/wallet-challenge.service';

// Funding wallets belong to billing and payout wallets to payouts; the route
// guard admits either manager and each handler checks the purpose it touches.
@Controller('wallets')
@ApiTags('wallets')
@AllowAuthMethods([AuthMethod.SESSION])
@UseGuards(AuthenticatedRateLimitGuard)
export class PaymentWalletController {
	constructor(
		private readonly wallets: PaymentWalletService,
		private readonly challenges: WalletChallengeService,
		private readonly organizationAccess: OrganizationAccessService
	) {}

	@Get()
	@ApiOperation({
		summary: 'List the payment wallets of the active organization',
		operationId: 'listPaymentWallets',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: PaymentWalletDto,
		isArray: true,
	})
	@RequiredAnyOrganizationPermissions({
		billing: ['read'],
		payouts: ['read'],
	})
	async list(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<PaymentWalletDto[]> {
		const wallets = await this.wallets.list(authContext.organizationId);
		return wallets.map(PaymentWalletDto.from);
	}

	@Post('challenge')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Issue the Sign-In With Ethereum message that links a wallet',
		operationId: 'createWalletChallenge',
	})
	@ApiResponse({ status: HttpStatus.OK, type: WalletChallengeDto })
	@RequiredAnyOrganizationPermissions({
		billing: ['manage'],
		payouts: ['manage'],
	})
	async createChallenge(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: CreateWalletChallengeDto
	): Promise<WalletChallengeDto> {
		await this.assertCanManage(authContext, input.purpose);
		return this.challenges.issue(
			authContext.organizationId,
			input.purpose,
			input.address
		);
	}

	@Post()
	@ApiOperation({
		summary: 'Link the wallet that signed a challenge',
		operationId: 'linkPaymentWallet',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: PaymentWalletDto })
	@RequireFreshSession()
	@RequiredAnyOrganizationPermissions({
		billing: ['manage'],
		payouts: ['manage'],
	})
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.PAYMENT_WALLET,
		targetIdFromResult: (result: PaymentWalletDto) => result.id,
		resultMetadata: {
			purpose: (result: PaymentWalletDto) => result.purpose,
			address: (result: PaymentWalletDto) => result.address,
			sanctionsStatus: (result: PaymentWalletDto) => result.sanctionsStatus,
		},
	})
	async link(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: LinkPaymentWalletDto
	): Promise<PaymentWalletDto> {
		await this.assertCanManage(authContext, input.purpose);
		return PaymentWalletDto.from(
			await this.wallets.link(authContext.organizationId, input)
		);
	}

	@Delete(':purpose')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Unlink the wallet of a purpose',
		operationId: 'unlinkPaymentWallet',
	})
	@ApiParam({
		name: 'purpose',
		enum: PaymentWalletPurpose,
		enumName: 'PaymentWalletPurpose',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@RequireFreshSession()
	@RequiredAnyOrganizationPermissions({
		billing: ['manage'],
		payouts: ['manage'],
	})
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.PAYMENT_WALLET,
		requestMetadata: { purpose: (request) => request.params.purpose },
	})
	async unlink(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('purpose', new ParseEnumPipe(PaymentWalletPurpose))
		purpose: PaymentWalletPurpose
	): Promise<void> {
		await this.assertCanManage(authContext, purpose);
		await this.wallets.unlink(authContext.organizationId, purpose);
	}

	private async assertCanManage(
		authContext: OrganizationAuthContext,
		purpose: PaymentWalletPurpose
	): Promise<void> {
		const granted = await this.organizationAccess.grantedToContext(
			authContext,
			[PAYMENT_WALLET_MANAGE_PERMISSION[purpose]]
		);
		if (granted.length === 0) throw new AccessDeniedException();
	}
}
