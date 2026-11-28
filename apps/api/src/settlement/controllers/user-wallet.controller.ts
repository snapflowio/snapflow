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
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { getAddress } from 'viem';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { TermsAcceptanceExempt } from '../../legal/decorators/terms-acceptance-exempt.decorator';
import { RefuseSanctionedRegions } from '../../location/decorators/refuse-sanctioned-regions.decorator';
import { SiweNonceDto } from '../dto/payment-wallet.dto';
import {
	CreateUserWalletDto,
	RecoveryOwnerDto,
	SubmitRecoveryOwnerDto,
	UserWalletDto,
} from '../dto/user-wallet.dto';
import {
	PreparedWalletTransactionDto,
	SubmitWalletTransactionDto,
	WalletCallDto,
	WalletTransactionDto,
} from '../dto/wallet-transaction.dto';
import { SiweLinkService } from '../services/wallets/siwe-link.service';
import { UserWalletService } from '../services/wallets/user-wallet.service';
import { WalletRecoveryService } from '../services/wallets/wallet-recovery.service';
import { WalletTransactionService } from '../services/wallets/wallet-transaction.service';

@Controller('user-wallet')
@ApiTags(OpenApiTag.USER_WALLET)
@AllowAuthMethods([AuthMethod.SESSION])
export class UserWalletController {
	constructor(
		private readonly wallets: UserWalletService,
		private readonly transactions: WalletTransactionService,
		private readonly recovery: WalletRecoveryService,
		private readonly siwe: SiweLinkService
	) {}

	@Get()
	@ApiOperation({
		summary: 'Get your passkey wallet',
		operationId: 'getUserWallet',
	})
	@ApiResponse({ status: HttpStatus.OK, type: UserWalletDto })
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description:
			'You have no wallet yet (code user_wallet_not_found); create it with createUserWallet',
	})
	async get(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<UserWalletDto> {
		return UserWalletDto.from(
			await this.wallets.findOrFail(authContext.userId)
		);
	}

	@Post()
	@RefuseSanctionedRegions()
	@ApiOperation({
		summary:
			'Create your passkey wallet: derive the Safe your P-256 passkey owns; it deploys with its first transaction',
		operationId: 'createUserWallet',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: UserWalletDto })
	async create(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: CreateUserWalletDto
	): Promise<UserWalletDto> {
		return UserWalletDto.from(
			await this.wallets.create(authContext.userId, input.passkeyId)
		);
	}

	@Post('transactions/prepare')
	@TermsAcceptanceExempt()
	@RefuseSanctionedRegions()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Quote and prepare a Safe transaction for your passkey to sign: a MultiSendCallOnly batch of the call followed by its exact USDC fee to the relayer, the nonce and the safeTxHash challenge. Refused when the call fails or the wallet cannot cover it and the fee',
		operationId: 'prepareWalletTransaction',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PreparedWalletTransactionDto })
	async prepare(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: WalletCallDto
	): Promise<PreparedWalletTransactionDto> {
		return this.transactions.prepare(
			await this.wallets.findOrFail(authContext.userId),
			{ ...input, to: getAddress(input.to), value: 0n },
			authContext
		);
	}

	@Post('transactions')
	@TermsAcceptanceExempt()
	@RefuseSanctionedRegions()
	@ApiOperation({
		summary:
			'Relay a passkey-signed Safe transaction exactly as it was prepared; Snapflow deploys the Safe on first use and the batch pays its USDC fee only when it succeeds',
		operationId: 'submitWalletTransaction',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: WalletTransactionDto })
	async submit(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: SubmitWalletTransactionDto
	): Promise<WalletTransactionDto> {
		const wallet = await this.wallets.findOrFail(authContext.userId);
		return WalletTransactionDto.from(
			await this.transactions.submit(
				wallet,
				{
					call: {
						to: getAddress(input.to),
						value: 0n,
						data: input.data,
						operation: input.operation,
					},
					nonce: BigInt(input.nonce),
					signature: input.signature,
					signingPasskeyId: input.signingPasskeyId,
				},
				authContext
			)
		);
	}

	@Get('transactions')
	@ApiOperation({
		summary: "List your wallet's relayed transactions, newest first",
		operationId: 'listWalletTransactions',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: WalletTransactionDto,
		isArray: true,
	})
	async list(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<WalletTransactionDto[]> {
		const wallet = await this.wallets.findOrFail(authContext.userId);
		return (await this.transactions.list(wallet.id)).map(
			WalletTransactionDto.from
		);
	}

	@Get('transactions/:transactionId')
	@ApiOperation({
		summary: 'Get one relayed wallet transaction',
		operationId: 'getWalletTransaction',
	})
	@ApiParam({ name: 'transactionId', format: 'uuid' })
	@ApiResponse({ status: HttpStatus.OK, type: WalletTransactionDto })
	async getTransaction(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('transactionId', ParseUUIDPipe) transactionId: string
	): Promise<WalletTransactionDto> {
		const wallet = await this.wallets.findOrFail(authContext.userId);
		return WalletTransactionDto.from(
			await this.transactions.get(wallet.id, transactionId)
		);
	}

	@Post('recovery-owner/siwe-nonce')
	@TermsAcceptanceExempt()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Issue a nonce and the fields of the Sign-In With Ethereum message an existing wallet signs to become your recovery owner',
		operationId: 'createRecoveryOwnerSiweNonce',
	})
	@ApiResponse({ status: HttpStatus.OK, type: SiweNonceDto })
	createRecoveryOwnerSiweNonce(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<SiweNonceDto> {
		return this.siwe.issueRecoveryOwnerNonce(authContext.userId);
	}

	@Post('recovery-owner/prepare')
	@TermsAcceptanceExempt()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Quote and prepare addOwnerWithThreshold(owner, 1) adding your recovery owner, for your passkey to sign',
		operationId: 'prepareRecoveryOwner',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PreparedWalletTransactionDto })
	async prepareRecoveryOwner(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: RecoveryOwnerDto
	): Promise<PreparedWalletTransactionDto> {
		return this.recovery.prepare(
			await this.wallets.findOrFail(authContext.userId),
			input,
			authContext
		);
	}

	@Post('recovery-owner')
	@TermsAcceptanceExempt()
	@ApiOperation({
		summary:
			'Relay the passkey-signed transaction adding your recovery owner; outgoing USDC transfers unlock once it is mined',
		operationId: 'addRecoveryOwner',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: WalletTransactionDto })
	async addRecoveryOwner(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: SubmitRecoveryOwnerDto
	): Promise<WalletTransactionDto> {
		return WalletTransactionDto.from(
			await this.recovery.submit(
				await this.wallets.findOrFail(authContext.userId),
				input,
				authContext
			)
		);
	}
}
