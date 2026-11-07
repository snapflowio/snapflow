/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	type EscrowAccount,
	getEscrowAccount,
	getVoucherDelegation,
	type VoucherDelegation,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import { getAddress, isAddressEqual, type TransactionReceipt } from 'viem';
import { SnapflowValidationError } from './errors/snapflow-error.js';
import {
	Escrow,
	type EscrowClients,
	type SessionKeyLimits,
} from './settlement/escrow.js';
import {
	VoucherSigner,
	type VoucherSignerOptions,
} from './settlement/voucher-signer.js';

/** USDC escrow settlement: the organization's escrow account, its wallet-side contract calls and client-mode voucher signing. */
export class SettlementService {
	constructor(private readonly client: Client) {}

	/** The escrow, USDC and chain Snapflow settles on, and the funding wallet's indexed balance. */
	public async escrowAccount(): Promise<EscrowAccount> {
		const response = await getEscrowAccount({ client: this.client });
		return response.data;
	}

	/** Snapflow's delegated voucher signer and the session key limits it suggests for the running sandboxes. */
	public async voucherDelegation(): Promise<VoucherDelegation> {
		const response = await getVoucherDelegation({ client: this.client });
		return response.data;
	}

	/** Binds the customer's wallet to the escrow Snapflow settles on, checking both clients use its chain. */
	public async escrow(clients: EscrowClients): Promise<Escrow> {
		const account = await this.escrowAccount();
		if (clients.publicClient.chain.id !== account.chainId) {
			throw new SnapflowValidationError(
				`Snapflow settles on chain ${account.chainId}, not ${clients.publicClient.chain.id}`
			);
		}
		return new Escrow({
			...clients,
			escrowAddress: getAddress(account.escrowAddress),
			usdcAddress: getAddress(account.usdcAddress),
		});
	}

	/**
	 * Authorizes Snapflow's delegated signer as a session key of the funding
	 * wallet, with the suggested limits unless `limits` overrides them.
	 */
	public async authorizeDelegatedSigner(
		escrow: Escrow,
		limits: Partial<SessionKeyLimits> = {}
	): Promise<TransactionReceipt> {
		const delegation = await this.voucherDelegation();
		if (
			delegation.chainId !== escrow.chainId ||
			!isAddressEqual(
				getAddress(delegation.escrowAddress),
				escrow.escrowAddress
			)
		) {
			throw new SnapflowValidationError(
				'The delegated signer belongs to another escrow'
			);
		}
		if (
			delegation.fundingWalletAddress === null ||
			!isAddressEqual(
				getAddress(delegation.fundingWalletAddress),
				escrow.account
			)
		) {
			throw new SnapflowValidationError(
				`Link ${escrow.account} as the organization's funding wallet before authorizing the delegated signer`
			);
		}
		return escrow.authorizeSessionKey(getAddress(delegation.signerAddress), {
			spendCap: BigInt(delegation.suggestedSpendCapMicroUsd),
			hourlyCap: BigInt(delegation.suggestedHourlyCapMicroUsd),
			expiry: BigInt(delegation.suggestedExpiry),
			...limits,
		});
	}

	/** Creates a signer for sandboxes created with `voucherSigning: 'client'`; call `start()` to begin. */
	public createVoucherSigner(options: VoucherSignerOptions): VoucherSigner {
		return new VoucherSigner(this.client, options);
	}
}
