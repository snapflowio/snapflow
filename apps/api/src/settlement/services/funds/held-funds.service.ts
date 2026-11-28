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
import { customerCreditBalances } from '../../../billing/queries/ledger-balance.query';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { HELD_FUND, type HeldFund } from '../../constants/held-funds.constants';
import { UserWallet } from '../../entities/user-wallet.entity';
import { escrowFunding } from '../../queries/escrow-funding.query';
import {
	customerBillingUnsettled,
	hostFundsHeld,
} from '../../queries/held-funds.query';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import { ChainClockService } from '../escrow/chain-clock.service';
import { SafeWalletChainService } from '../wallets/safe-wallet-chain.service';

@Injectable()
export class HeldFundsService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly chainClock: ChainClockService,
		private readonly walletChain: SafeWalletChainService
	) {}

	async organization(organizationId: string): Promise<HeldFund[]> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const [funding, hostFunds, billingUnsettled, credits] = await Promise.all([
			this.chainClock
				.now()
				.then((now) => escrowFunding(manager, escrow, organizationId, now)),
			hostFundsHeld(manager, escrow, organizationId),
			customerBillingUnsettled(manager, escrow, organizationId),
			customerCreditBalances(manager, [organizationId]),
		]);
		const held: HeldFund[] = [];
		const escrowBalance = funding.freeMicroUsd.add(
			funding.pendingWithdrawalMicroUsd
		);
		if (escrowBalance.isPositive()) held.push(HELD_FUND.ESCROW_BALANCE);
		if (funding.frozenMicroUsd.isPositive()) {
			held.push(HELD_FUND.FROZEN_ESCROW);
		}
		const channelsOpen =
			billingUnsettled || funding.outstandingMicroUsd.isPositive();
		if (channelsOpen) held.push(HELD_FUND.OPEN_PAYMENT_CHANNELS);
		const credit = credits.get(organizationId) ?? MicroUsd.ZERO;
		const creditOwed = credit
			.subtract(escrowBalance)
			.subtract(funding.frozenMicroUsd);
		if (!channelsOpen && creditOwed.isPositive()) {
			held.push(HELD_FUND.LEDGER_CREDIT);
		}
		if (hostFunds) held.push(HELD_FUND.HOST_EARNINGS);
		return held;
	}

	async wallet(userId: string): Promise<HeldFund[]> {
		const wallet = await this.entityManager
			.fork()
			.findOne(UserWallet, { userId }, { fields: ['safeAddress'] });
		if (!wallet) return [];
		const balance = await this.walletChain.usdcBalance(wallet.safeAddress);
		return balance > 0n ? [HELD_FUND.WALLET_USDC] : [];
	}
}
