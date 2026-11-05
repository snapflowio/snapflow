/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { pricedLeases } from '../../billing/queries/lease-price.query';
import { leaseShape } from '../../billing/utils/lease-pricing.util';
import { addDays } from '../../common/utils/time.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { runningHourlyPrice } from '../../marketplace/utils/pricing.util';
import { DELEGATION_SUGGESTION } from '../constants/payment-channel.constants';
import {
	DelegatedSessionKeyDto,
	type VoucherDelegationDto,
} from '../dto/voucher-delegation.dto';
import { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import { PaymentChannelState } from '../enums/payment-channel-state.enum';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { VoucherSigningMode } from '../enums/voucher-signing-mode.enum';
import { configuredEscrow } from '../utils/escrow-identity.util';
import { chainSeconds } from '../utils/voucher-schedule.util';
import { VoucherSigningService } from './voucher-signing.service';

// What an organization's funding wallet needs to grant Snapflow's signer a
// session key, with caps sized from what its delegated sandboxes cost now.
@Injectable()
export class VoucherDelegationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly signing: VoucherSigningService
	) {}

	async delegation(organizationId: string): Promise<VoucherDelegationDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const now = await databaseNow(manager);
		const wallet = await manager.findOne(PaymentWallet, {
			organizationId,
			purpose: PaymentWalletPurpose.FUNDING,
		});
		const key = wallet
			? await this.signing.delegatedKey(
					manager,
					{ ...escrow, customerAddress: wallet.address },
					now
				)
			: null;
		const hourlyRate = await this.delegatedHourlyRate(manager, organizationId);
		const hourlyCap = hourlyRate
			.multiply(DELEGATION_SUGGESTION.hourlyCapRunRateHours)
			.max(DELEGATION_SUGGESTION.minimumHourlyCapMicroUsd);
		const spendCap = hourlyRate
			.multiply(DELEGATION_SUGGESTION.spendCapRunRateHours)
			.max(hourlyCap);
		return {
			chainId: escrow.chainId,
			escrowAddress: escrow.contractAddress,
			signerAddress: this.signing.signerAddress,
			fundingWalletAddress: wallet?.address ?? null,
			sessionKey: key ? DelegatedSessionKeyDto.from(key) : null,
			suggestedHourlyCapMicroUsd: hourlyCap.toString(),
			suggestedSpendCapMicroUsd: spendCap.toString(),
			suggestedExpiry: chainSeconds(
				addDays(now, DELEGATION_SUGGESTION.expiryDays)
			).toString(),
		};
	}

	// The all-in hourly price of every running lease whose vouchers Snapflow
	// signs.
	private async delegatedHourlyRate(
		manager: EntityManager,
		organizationId: string
	): Promise<MicroUsd> {
		const channels = await manager.find(
			PaymentChannel,
			{
				...configuredEscrow(this.config),
				customerOrganizationId: organizationId,
				state: PaymentChannelState.OPEN,
				signingMode: VoucherSigningMode.DELEGATED,
			},
			{ fields: ['leaseId'] }
		);
		const leaseIds = channels.map(({ leaseId }) => leaseId);
		if (leaseIds.length === 0) return MicroUsd.ZERO;
		const terms = await pricedLeases(manager, leaseIds);
		const leases = await manager.find(SandboxLease, { id: { $in: leaseIds } });
		return MicroUsd.sum(
			leases.map((lease) => {
				const leaseTerms = terms.get(lease.id);
				if (!leaseTerms) throw new Error(`Lease ${lease.id} has no price`);
				return runningHourlyPrice(leaseTerms, leaseShape(lease)).grossMicroUsd;
			})
		);
	}
}
