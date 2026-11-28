/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Inject, Injectable } from '@nestjs/common';
import { MAX_RELAY_FEE } from '@snapflow/contracts';
import type { Address, Hex, PublicClient } from 'viem';
import { estimateL1Fee } from 'viem/op-stack';
import { ceilDivide } from '../../../common/utils/fixed-point.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { SettingsService } from '../../../settings/services/settings.service';
import { chainlinkAggregatorAbi } from '../../constants/chainlink.constants';
import {
	ETH_USD_FEED_MAXIMUM_AGE_SECONDS,
	HOST_SETTLEMENT_GAS,
} from '../../constants/host-settlement.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../constants/settlement.constants';
import { chainSeconds } from '../../utils/escrow/escrow-amount.util';
import {
	type EthUsdPrice,
	gasCostMicroUsd,
	type RelayPricing,
	type SettlementFeeQuote,
	withMargin,
} from '../../utils/relay/gas-cost.util';
import { placeholderHostSettlementCalldata } from '../../utils/settlements/host-settlement-call.util';
import { ChainClockService } from '../escrow/chain-clock.service';

const FIXED_PRICE_DECIMALS = 0;

const QUOTED_SETTLEMENT_CLAIMS = 1;

export interface PricedTransaction {
	account: Address;
	to: Address;
	data: Hex;
	gas: bigint;
}

@Injectable()
export class RelayFeeQuoteService {
	constructor(
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService,
		private readonly chainClock: ChainClockService,
		private readonly settings: SettingsService
	) {}

	async pricing(): Promise<RelayPricing> {
		const [weiPerGas, ethUsd, settings] = await Promise.all([
			this.client.getGasPrice(),
			this.ethUsd(),
			this.settings.get(),
		]);
		return {
			weiPerGas,
			ethUsd,
			marginBasisPoints: BigInt(settings.relayFeeMarginBasisPoints),
		};
	}

	async transactionPricing(
		transaction: PricedTransaction
	): Promise<RelayPricing> {
		const [pricing, l1FeeWei] = await Promise.all([
			this.pricing(),
			this.l1FeeWei(transaction),
		]);
		return {
			...pricing,
			weiPerGas: pricing.weiPerGas + ceilDivide(l1FeeWei, transaction.gas),
		};
	}

	cost(gas: bigint, pricing: RelayPricing): bigint {
		return withMargin(gasCostMicroUsd(gas, pricing), pricing.marginBasisPoints);
	}

	hostSettlementGas(claims: number): bigint {
		return (
			HOST_SETTLEMENT_GAS.WITHDRAWAL +
			HOST_SETTLEMENT_GAS.PER_CLAIM * BigInt(claims)
		);
	}

	async hostSettlementQuote(): Promise<SettlementFeeQuote> {
		const gas = this.hostSettlementGas(QUOTED_SETTLEMENT_CLAIMS);
		const pricing = await this.transactionPricing({
			account: this.config.get('settlement.relayerAddress'),
			to: this.config.get('settlement.escrowAddress'),
			data: placeholderHostSettlementCalldata(QUOTED_SETTLEMENT_CLAIMS),
			gas,
		});
		return {
			baseMicroUsd: this.cost(HOST_SETTLEMENT_GAS.WITHDRAWAL, pricing),
			perClaimMicroUsd: this.cost(HOST_SETTLEMENT_GAS.PER_CLAIM, pricing),
			maximumMicroUsd: MAX_RELAY_FEE,
		};
	}

	private l1FeeWei(transaction: PricedTransaction): Promise<bigint> {
		if (!this.client.chain?.contracts?.gasPriceOracle) {
			return Promise.resolve(0n);
		}
		return estimateL1Fee(this.client, { ...transaction, chain: undefined });
	}

	private async ethUsd(): Promise<EthUsdPrice> {
		const { feedAddress, fixedPriceUsd } = this.config.get(
			'settlement.ethUsdPrice'
		);
		if (feedAddress === null) {
			return {
				answer: BigInt(fixedPriceUsd),
				decimals: FIXED_PRICE_DECIMALS,
			};
		}
		const feed = { address: feedAddress, abi: chainlinkAggregatorAbi } as const;
		const [decimals, [, answer, , updatedAt], chainNow] = await Promise.all([
			this.client.readContract({ ...feed, functionName: 'decimals' }),
			this.client.readContract({ ...feed, functionName: 'latestRoundData' }),
			this.chainClock.now(),
		]);
		const age = chainSeconds(chainNow) - updatedAt;
		if (answer <= 0n || age > BigInt(ETH_USD_FEED_MAXIMUM_AGE_SECONDS)) {
			throw new Error(
				`The ETH/USD feed at ${feedAddress} answered ${answer}, ${age} seconds old`
			);
		}
		return { answer, decimals };
	}
}
