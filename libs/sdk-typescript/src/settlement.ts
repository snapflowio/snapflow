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
	type AutoTopUp,
	createDelegatedSigner,
	type EscrowAccount,
	getAutoTopUp,
	getEscrowAccount,
	getHostEscrowBalance,
	getPaymentChannel,
	getVoucherDelegation,
	type HostEscrowBalance,
	type ListPaymentChannelsData,
	listPaymentChannels,
	type PaymentChannel,
	type PaymentChannelPage,
	type UpdateAutoTopUp,
	updateAutoTopUp,
	type VoucherDelegation,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import { getAddress, type Hash, type TransactionReceipt } from 'viem';
import { SnapflowValidationError } from './errors/snapflow-error.js';
import {
	addressOf,
	assertDelegationFor,
	delegatedSignerAuthorizationFrom,
} from './settlement/delegation.js';
import {
	type AutoTopUpSetup,
	type AutoTopUpTerms,
	Escrow,
} from './settlement/escrow.js';
import type {
	EscrowClients,
	EscrowExecutorClients,
} from './settlement/escrow-transaction.js';
import type {
	SignerAuthorization,
	SignerScope,
} from './settlement/escrow-types.js';
import { fetchChargedFeeBps } from './settlement/settlement-fees.js';
import {
	VoucherSigner,
	type VoucherSignerOptions,
} from './settlement/voucher-signer.js';

export type PaymentChannelQuery = NonNullable<ListPaymentChannelsData['query']>;

export interface AutoTopUpOptions extends Omit<UpdateAutoTopUp, 'enabled'> {
	allowance: bigint;
}

export interface DelegatedPaymentsSetup {
	deposit?: bigint;
	signerScope?: Partial<SignerScope>;
}

export class SettlementService {
	constructor(private readonly client: Client) {}

	public async escrowAccount(): Promise<EscrowAccount> {
		const response = await getEscrowAccount({ client: this.client });
		return response.data;
	}

	public async hostBalance(): Promise<HostEscrowBalance> {
		const response = await getHostEscrowBalance({ client: this.client });
		return response.data;
	}

	public async voucherDelegation(): Promise<VoucherDelegation> {
		const response = await getVoucherDelegation({ client: this.client });
		return response.data;
	}

	public chargedFeeBps(): Promise<number> {
		return fetchChargedFeeBps(this.client);
	}

	public async channels(
		query: PaymentChannelQuery = {}
	): Promise<PaymentChannelPage> {
		const response = await listPaymentChannels({ client: this.client, query });
		return response.data;
	}

	public async channel(paymentChannelId: string): Promise<PaymentChannel> {
		const response = await getPaymentChannel({
			client: this.client,
			path: { paymentChannelId },
		});
		return response.data;
	}

	public async autoTopUp(): Promise<AutoTopUp> {
		const response = await getAutoTopUp({ client: this.client });
		return response.data;
	}

	public async updateAutoTopUp(settings: UpdateAutoTopUp): Promise<AutoTopUp> {
		const response = await updateAutoTopUp({
			client: this.client,
			body: settings,
		});
		return response.data;
	}

	public async escrow(
		clients: EscrowClients | EscrowExecutorClients
	): Promise<Escrow> {
		const [account, feeBps] = await Promise.all([
			this.escrowAccount(),
			this.chargedFeeBps(),
		]);
		if (clients.publicClient.chain.id !== account.chainId) {
			throw new SnapflowValidationError(
				`Snapflow settles on chain ${account.chainId}, not ${clients.publicClient.chain.id}`
			);
		}
		return new Escrow({
			...clients,
			escrowAddress: getAddress(account.escrowAddress),
			usdcAddress: getAddress(account.usdcAddress),
			feeBps,
		});
	}

	public async delegatedSignerAuthorization(
		escrow: Escrow,
		scope: Partial<SignerScope> = {}
	): Promise<SignerAuthorization> {
		assertDelegationFor(await this.voucherDelegation(), escrow);
		const response = await createDelegatedSigner({ client: this.client });
		return delegatedSignerAuthorizationFrom(response.data, scope);
	}

	public async authorizeDelegatedSigner(
		escrow: Escrow,
		scope: Partial<SignerScope> = {}
	): Promise<TransactionReceipt> {
		return escrow.authorizeSigner(
			await this.delegatedSignerAuthorization(escrow, scope)
		);
	}

	public async setUpDelegatedPayments(
		escrow: Escrow,
		setup: DelegatedPaymentsSetup = {}
	): Promise<Hash[]> {
		return escrow.depositAndAuthorize({
			deposit: setup.deposit,
			signers: [
				await this.delegatedSignerAuthorization(escrow, setup.signerScope),
			],
		});
	}

	public async autoTopUpSetup(
		limits: AutoTopUpTerms,
		allowance: bigint
	): Promise<AutoTopUpSetup> {
		const { relayerAddress } = await this.autoTopUp();
		return {
			limits: { ...limits, relayer: addressOf(relayerAddress, 'relayer') },
			allowance,
		};
	}

	public async enableAutoTopUp(
		escrow: Escrow,
		options: AutoTopUpOptions
	): Promise<AutoTopUp> {
		const { allowance, ...terms } = options;
		const settings = await this.updateAutoTopUp({ ...terms, enabled: true });
		await escrow.enableAutoTopUp({
			limits: {
				relayer: addressOf(settings.relayerAddress, 'relayer'),
				amount: BigInt(settings.amount),
				threshold: BigInt(settings.threshold),
				maxRelayFee: BigInt(settings.maxRelayFee),
				minInterval: settings.minInterval,
			},
			allowance,
		});
		return settings;
	}

	public async disableAutoTopUp(escrow: Escrow): Promise<AutoTopUp> {
		const current = await this.autoTopUp();
		const settings = await this.updateAutoTopUp({
			enabled: false,
			amount: current.amount,
			threshold: current.threshold,
			maxRelayFee: current.maxRelayFee,
			timesPerDay: current.timesPerDay,
		});
		if (current.limits !== null) await escrow.disableAutoTopUp();
		return settings;
	}

	public createVoucherSigner(options: VoucherSignerOptions): VoucherSigner {
		return new VoucherSigner(this.client, options);
	}
}
