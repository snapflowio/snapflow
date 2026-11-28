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
	Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { RequireFreshSession } from '../../auth/decorators/require-fresh-session.decorator';
import { OrganizationAccessService } from '../../auth/services/organization-access.service';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RefuseSanctionedRegions } from '../../location/decorators/refuse-sanctioned-regions.decorator';
import { RequiredAnyOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { PAYMENT_WALLET_MANAGE_PERMISSION } from '../constants/payment-wallet.constants';
import {
	LinkPaymentWalletDto,
	PaymentWalletDto,
	PaymentWalletPurposeParamsDto,
	SiweNonceDto,
	WalletPurposeRequestDto,
} from '../dto/payment-wallet.dto';
import type { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { PaymentWalletService } from '../services/wallets/payment-wallet.service';
import { SiweLinkService } from '../services/wallets/siwe-link.service';
import { UserWalletService } from '../services/wallets/user-wallet.service';

@Controller('wallets')
@ApiTags(OpenApiTag.WALLETS)
@AllowAuthMethods([AuthMethod.SESSION])
export class PaymentWalletController {
	constructor(
		private readonly wallets: PaymentWalletService,
		private readonly siwe: SiweLinkService,
		private readonly userWallets: UserWalletService,
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

	@Post('siwe-nonce')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Issue a nonce and the fields of the Sign-In With Ethereum message that links a wallet',
		operationId: 'createWalletSiweNonce',
	})
	@ApiResponse({ status: HttpStatus.OK, type: SiweNonceDto })
	@RequiredAnyOrganizationPermissions({
		billing: ['manage'],
		payouts: ['manage'],
	})
	async createSiweNonce(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: WalletPurposeRequestDto
	): Promise<SiweNonceDto> {
		await this.assertCanManage(authContext, input.purpose);
		return this.siwe.issueNonce(authContext.organizationId, input.purpose);
	}

	@Post()
	@RefuseSanctionedRegions()
	@ApiOperation({
		summary: 'Link the wallet that signed a Sign-In With Ethereum message',
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

	@Post('own')
	@RefuseSanctionedRegions()
	@ApiOperation({
		summary: "Link the signed-in user's passkey Safe for a purpose",
		operationId: 'linkOwnPaymentWallet',
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
	async linkOwn(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: WalletPurposeRequestDto
	): Promise<PaymentWalletDto> {
		await this.assertCanManage(authContext, input.purpose);
		const wallet = await this.userWallets.findOrFail(authContext.userId);
		return PaymentWalletDto.from(
			await this.wallets.linkAddress(
				authContext.organizationId,
				input.purpose,
				wallet.safeAddress
			)
		);
	}

	@Delete(':purpose')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Unlink the wallet of a purpose',
		operationId: 'unlinkPaymentWallet',
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
		@Param() { purpose }: PaymentWalletPurposeParamsDto
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
