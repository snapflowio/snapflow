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
import { type Address, maxUint256, type PublicClient, zeroAddress } from 'viem';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../constants/settlement.constants';

export interface EscrowPolicy {
	withdrawalDelaySeconds: number;
	claimWindowSeconds: number;
	signerThawSeconds: number;
}

@Injectable()
export class EscrowPolicyService {
	#loading: Promise<EscrowPolicy> | null = null;

	constructor(
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService
	) {}

	policy(): Promise<EscrowPolicy> {
		if (this.#loading === null) {
			this.#loading = this.load().catch((error: unknown) => {
				this.#loading = null;
				throw error;
			});
		}
		return this.#loading;
	}

	async depositRoom(customer: Address | undefined): Promise<bigint | null> {
		const room = await this.client.readContract({
			address: this.config.get('settlement.escrowAddress'),
			abi: snapflowEscrowAbi,
			functionName: 'maxDepositOf',
			args: [customer ?? zeroAddress],
		});
		return room === maxUint256 ? null : room;
	}

	private async load(): Promise<EscrowPolicy> {
		const contract = {
			address: this.config.get('settlement.escrowAddress'),
			abi: snapflowEscrowAbi,
		} as const;
		const [withdrawalDelay, claimWindow, signerThawPeriod] = await Promise.all([
			this.client.readContract({
				...contract,
				functionName: 'withdrawalDelay',
			}),
			this.client.readContract({ ...contract, functionName: 'claimWindow' }),
			this.client.readContract({
				...contract,
				functionName: 'signerThawPeriod',
			}),
		]);
		return {
			withdrawalDelaySeconds: Number(withdrawalDelay),
			claimWindowSeconds: Number(claimWindow),
			signerThawSeconds: Number(signerThawPeriod),
		};
	}
}
