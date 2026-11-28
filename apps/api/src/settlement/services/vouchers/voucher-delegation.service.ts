/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { feeBpsForMarkup } from '@snapflow/contracts';
import { zeroAddress } from 'viem';
import { BASIS_POINTS_DENOMINATOR } from '../../../common/constants/money.constants';
import { addDays, addSeconds } from '../../../common/utils/time.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SettingsService } from '../../../settings/services/settings.service';
import { DELEGATION_SUGGESTION } from '../../constants/delegated-signer.constants';
import { SettlementErrorCode } from '../../constants/payment-channel.constants';
import { EscrowWindowsDto } from '../../dto/escrow.dto';
import {
	type DelegatedSignerAuthorizationDto,
	EscrowSignerGrantDto,
	type SignerScopeDto,
	type VoucherDelegationDto,
} from '../../dto/voucher-delegation.dto';
import { PaymentWallet } from '../../entities/payment-wallet.entity';
import { PaymentWalletPurpose } from '../../enums/payment-wallet-purpose.enum';
import { committedHourlySpend } from '../../queries/committed-hourly-spend.query';
import { escrowUnfrozenSeconds } from '../../queries/escrow-unfrozen-time.query';
import { chainSeconds, maxBigInt } from '../../utils/escrow/escrow-amount.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import { DelegatedSignerService } from '../delegated-signer/delegated-signer.service';
import { ChainClockService } from '../escrow/chain-clock.service';
import { EscrowPolicyService } from '../escrow/escrow-policy.service';

@Injectable()
export class VoucherDelegationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly settings: SettingsService,
		private readonly escrowPolicy: EscrowPolicyService,
		private readonly delegatedSigners: DelegatedSignerService,
		private readonly chainClock: ChainClockService
	) {}

	async delegation(organizationId: string): Promise<VoucherDelegationDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const chainNow = await this.chainClock.now();
		const wallet = await this.fundingWallet(manager, organizationId);
		const signer = wallet
			? await this.delegatedSigners.forCustomer(manager, wallet.address)
			: null;
		const grant = signer
			? await this.delegatedSigners.grant(manager, signer)
			: null;
		const hourly = await committedHourlySpend(manager, organizationId);
		return {
			chainId: escrow.chainId,
			escrowAddress: escrow.contractAddress,
			fundingWalletAddress: wallet?.address ?? null,
			windows: EscrowWindowsDto.from(await this.escrowPolicy.policy()),
			delegatedSignerAddress: signer?.signerAddress ?? null,
			delegatedSigner: grant
				? EscrowSignerGrantDto.from(
						grant,
						await escrowUnfrozenSeconds(manager, escrow, chainNow),
						chainNow
					)
				: null,
			hourlySpendMicroUsd: hourly.toString(),
			suggestedSignerScope: await this.suggestedScope(hourly, chainNow),
			chainNowSeconds: chainSeconds(chainNow).toString(),
		};
	}

	async authorize(
		organizationId: string
	): Promise<DelegatedSignerAuthorizationDto> {
		const manager = this.entityManager.fork();
		const wallet = await this.fundingWallet(manager, organizationId);
		if (!wallet) {
			throw new ConflictException({
				code: SettlementErrorCode.FUNDING_WALLET_REQUIRED,
				message: 'Link a funding wallet before delegating voucher signing',
			});
		}
		const { signer, bound } = await this.delegatedSigners.ensure(
			organizationId,
			wallet.address
		);
		if (bound) {
			throw new ConflictException({
				code: SettlementErrorCode.DELEGATED_SIGNER_ALREADY_AUTHORIZED,
				message:
					'The funding wallet already authorized its delegated signer; raise or lower its limit instead',
				signerAddress: signer.signerAddress,
			});
		}
		return manager.transactional(async (transaction) => {
			const now = await databaseNow(transaction);
			const chainNow = await this.chainClock.now();
			const proofDeadline = chainSeconds(
				addSeconds(chainNow, DELEGATION_SUGGESTION.proofLifetimeSeconds)
			);
			const proof = await this.delegatedSigners.signProof(
				transaction,
				signer,
				proofDeadline,
				now
			);
			return {
				signerAddress: signer.signerAddress,
				proofDeadline: proofDeadline.toString(),
				proof,
				suggestedScope: await this.suggestedScope(
					await committedHourlySpend(transaction, organizationId),
					chainNow
				),
			};
		});
	}

	private fundingWallet(
		manager: EntityManager,
		organizationId: string
	): Promise<PaymentWallet | null> {
		return manager.findOne(PaymentWallet, {
			organizationId,
			purpose: PaymentWalletPurpose.FUNDING,
		});
	}

	private async suggestedScope(
		hourly: bigint,
		chainNow: Date
	): Promise<SignerScopeDto> {
		const { markupBasisPoints, delegatedSignerMinimumHourlyCapCents } =
			await this.settings.get();
		const hourlyCap = maxBigInt(
			MicroUsd.fromCents(delegatedSignerMinimumHourlyCapCents).toBigInt(),
			(hourly * DELEGATION_SUGGESTION.hourlyCapHeadroomBasisPoints) /
				BASIS_POINTS_DENOMINATOR
		);
		return {
			hourlyCap: hourlyCap.toString(),
			expiry: chainSeconds(
				addDays(chainNow, DELEGATION_SUGGESTION.expiryDays)
			).toString(),
			maxFeeBps: feeBpsForMarkup(markupBasisPoints),
			host: zeroAddress,
		};
	}
}
