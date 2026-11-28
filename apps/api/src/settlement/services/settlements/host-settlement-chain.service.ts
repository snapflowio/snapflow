/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Inject, Injectable } from '@nestjs/common';
import { MAX_RELAY_FEE, snapflowEscrowAbi } from '@snapflow/contracts';
import { type Address, BaseError, type Hex, type PublicClient } from 'viem';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import {
	HOST_SETTLEMENT_FAILURE,
	HOST_SETTLEMENT_GAS,
} from '../../constants/host-settlement.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../constants/settlement.constants';
import {
	callRevertReason,
	isChainUnreachable,
} from '../../utils/chain-error.util';
import { maxBigInt } from '../../utils/escrow/escrow-amount.util';
import { claimBatchGasFloor } from '../../utils/settlements/claim-batch-gas.util';
import { RelayFeeQuoteService } from '../relay/relay-fee-quote.service';

export type SettlementSimulation =
	| { gas: bigint; requiredFee: bigint; failure: null }
	| { gas: null; requiredFee: null; failure: string };

@Injectable()
export class HostSettlementChainService {
	constructor(
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService,
		private readonly quotes: RelayFeeQuoteService
	) {}

	withdrawalNonce(host: Address): Promise<bigint> {
		return this.client.readContract({
			address: this.config.get('settlement.escrowAddress'),
			abi: snapflowEscrowAbi,
			functionName: 'hostWithdrawalNonceOf',
			args: [host],
		});
	}

	async simulate(data: Hex, claims: number): Promise<SettlementSimulation> {
		const account = this.config.get('settlement.relayerAddress');
		const to = this.config.get('settlement.escrowAddress');
		let estimate: bigint;
		try {
			estimate = await this.client.estimateGas({ account, to, data });
		} catch (error) {
			if (!(error instanceof BaseError) || isChainUnreachable(error)) {
				throw error;
			}
			return {
				gas: null,
				requiredFee: null,
				failure: callRevertReason(error, snapflowEscrowAbi),
			};
		}
		const gas = maxBigInt(estimate, this.quotes.hostSettlementGas(claims));
		const requiredFee = this.quotes.cost(
			gas,
			await this.quotes.transactionPricing({ account, to, data, gas })
		);
		if (requiredFee > MAX_RELAY_FEE) {
			return {
				gas: null,
				requiredFee: null,
				failure: HOST_SETTLEMENT_FAILURE.GAS_ABOVE_MAXIMUM_FEE,
			};
		}
		return {
			gas: maxBigInt(
				gas,
				claimBatchGasFloor(data, claims, HOST_SETTLEMENT_GAS.WITHDRAWAL)
			),
			requiredFee,
			failure: null,
		};
	}
}
