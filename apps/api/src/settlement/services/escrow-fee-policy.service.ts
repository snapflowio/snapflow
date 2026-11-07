/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { snapflowEscrowAbi } from '@snapflow/contracts';
import type { Address, PublicClient } from 'viem';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { SELF_USE_MARKUP_BASIS_POINTS } from '../../marketplace/constants/marketplace.constants';
import { ESCROW_FEE_POLICY_CACHE_MILLISECONDS } from '../constants/escrow.constants';
import { PaymentChannelErrorCode } from '../constants/payment-channel.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../constants/settlement.constants';

export interface EscrowFeePolicy {
	feeCapBasisPoints: number;
	feeRecipient: Address;
}

interface CachedPolicy {
	policy: EscrowFeePolicy;
	loadedAt: number;
}

// The escrow's live fee cap and fee recipient, read from the chain and kept
// for a minute. Concurrent callers share one read.
@Injectable()
export class EscrowFeePolicyService {
	#cached: CachedPolicy | null = null;
	#loading: Promise<EscrowFeePolicy> | null = null;

	constructor(
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService
	) {}

	policy(): Promise<EscrowFeePolicy> {
		const cached = this.#cached;
		if (
			cached &&
			Date.now() - cached.loadedAt < ESCROW_FEE_POLICY_CACHE_MILLISECONDS
		) {
			return Promise.resolve(cached.policy);
		}
		if (this.#loading !== null) return this.#loading;
		const loading = this.load().finally(() => {
			this.#loading = null;
		});
		this.#loading = loading;
		return loading;
	}

	// The escrow refuses a voucher whose fee exceeds the cap on its host
	// increase, so a lease must not open, nor be quoted, at a higher markup.
	// A lease without markup, on the customer's own machine, fits any cap.
	async assertMarkupAllowed(markupBasisPoints: number): Promise<void> {
		if (markupBasisPoints === SELF_USE_MARKUP_BASIS_POINTS) return;
		const { feeCapBasisPoints } = await this.policy();
		if (markupBasisPoints <= feeCapBasisPoints) return;
		throw new ConflictException({
			code: PaymentChannelErrorCode.MARKUP_ABOVE_FEE_CAP,
			message: `The markup of ${markupBasisPoints} basis points is above the escrow fee cap of ${feeCapBasisPoints} basis points, so the escrow would refuse to pay it`,
			markupBasisPoints,
			feeCapBasisPoints,
		});
	}

	private async load(): Promise<EscrowFeePolicy> {
		const contract = {
			address: this.config.get('settlement.escrowAddress'),
			abi: snapflowEscrowAbi,
		} as const;
		const [feeCapBasisPoints, feeRecipient] = await Promise.all([
			this.client.readContract({ ...contract, functionName: 'feeCapBps' }),
			this.client.readContract({ ...contract, functionName: 'feeRecipient' }),
		]);
		const policy = { feeCapBasisPoints, feeRecipient };
		this.#cached = { policy, loadedAt: Date.now() };
		return policy;
	}
}
