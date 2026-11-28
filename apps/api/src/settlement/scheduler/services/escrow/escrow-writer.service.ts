/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Inject, Injectable } from '@nestjs/common';
import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	type Address,
	encodeFunctionData,
	type Hex,
	type PublicClient,
} from 'viem';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { CLAIM_BATCH_OVERHEAD_GAS } from '../../../constants/host-settlement.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../../constants/settlement.constants';
import type { EscrowClaimItem } from '../../../types/escrow.types';
import type {
	ClaimBatchCall,
	OperatorCall,
} from '../../../types/operator-transaction.types';
import { maxBigInt } from '../../../utils/escrow/escrow-amount.util';
import { claimBatchGasFloor } from '../../../utils/settlements/claim-batch-gas.util';

@Injectable()
export class EscrowWriterService {
	constructor(
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService
	) {}

	async claimBatch(items: readonly EscrowClaimItem[]): Promise<ClaimBatchCall> {
		const call = {
			...this.contract(),
			functionName: 'claimBatch',
			args: [items],
		} as const;
		const { result: paid } = await this.client.simulateContract(call);
		const data = encodeFunctionData(call);
		const gas = maxBigInt(
			await this.client.estimateContractGas(call),
			claimBatchGasFloor(data, items.length, CLAIM_BATCH_OVERHEAD_GAS)
		);
		return { call: { ...this.operatorCall(data), gas }, paid };
	}

	async withdrawHost(host: Address): Promise<OperatorCall> {
		const call = {
			...this.contract(),
			functionName: 'withdrawHost',
			args: [host],
		} as const;
		await this.client.simulateContract(call);
		return this.operatorCall(encodeFunctionData(call));
	}

	async sweepFees(feeReceiver: Address): Promise<OperatorCall> {
		const call = {
			...this.contract(),
			functionName: 'sweepFees',
			args: [feeReceiver],
		} as const;
		await this.client.simulateContract(call);
		return this.operatorCall(encodeFunctionData(call));
	}

	async autoTopUp(
		customer: Address,
		relayFee: bigint
	): Promise<Required<OperatorCall>> {
		const call = {
			...this.contract(),
			functionName: 'autoTopUp',
			args: [customer, relayFee],
		} as const;
		await this.client.simulateContract(call);
		const gas = await this.client.estimateContractGas(call);
		return { ...this.operatorCall(encodeFunctionData(call)), gas };
	}

	private operatorCall(data: Hex): OperatorCall {
		return { to: this.config.get('settlement.escrowAddress'), data };
	}

	private contract() {
		return {
			account: this.config.get('settlement.relayerAddress'),
			address: this.config.get('settlement.escrowAddress'),
			abi: snapflowEscrowAbi,
		} as const;
	}
}
