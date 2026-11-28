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
	createWalletSiweNonce,
	linkOwnPaymentWallet,
	linkPaymentWallet,
	listPaymentWallets,
	type PaymentWallet,
	type PaymentWalletPurpose,
	type SiweNonce,
	type SiweProof,
	unlinkPaymentWallet,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import type {
	Account,
	Address,
	Chain,
	Hex,
	Transport,
	WalletClient,
} from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { SnapflowWalletError } from '../errors/wallet-error.js';

export type SiweSigner = Pick<
	WalletClient<Transport, Chain | undefined, Account>,
	'account' | 'signMessage'
>;

export function siweLinkMessage(nonce: SiweNonce, address: Address): string {
	return createSiweMessage({
		address,
		chainId: nonce.chainId,
		domain: nonce.domain,
		uri: nonce.uri,
		version: nonce.version,
		statement: nonce.statement,
		nonce: nonce.nonce,
		issuedAt: new Date(nonce.issuedAt),
		expirationTime: new Date(nonce.expirationTime),
	});
}

export async function siweProof(
	nonce: SiweNonce,
	wallet: SiweSigner
): Promise<SiweProof> {
	const message = siweLinkMessage(nonce, wallet.account.address);
	let signature: Hex;
	try {
		signature = await wallet.signMessage({ account: wallet.account, message });
	} catch (error) {
		throw new SnapflowWalletError(
			`The wallet did not sign the Sign-In With Ethereum message: ${error instanceof Error ? error.message : String(error)}`,
			undefined,
			error
		);
	}
	return { message, signature };
}

export class PaymentWalletService {
	constructor(private readonly client: Client) {}

	public async list(): Promise<PaymentWallet[]> {
		const response = await listPaymentWallets({ client: this.client });
		return response.data;
	}

	public async link(
		purpose: PaymentWalletPurpose,
		wallet: SiweSigner
	): Promise<PaymentWallet> {
		const nonce = await createWalletSiweNonce({
			client: this.client,
			body: { purpose },
		});
		const proof = await siweProof(nonce.data, wallet);
		const response = await linkPaymentWallet({
			client: this.client,
			body: { purpose, ...proof },
		});
		return response.data;
	}

	public async linkOwn(purpose: PaymentWalletPurpose): Promise<PaymentWallet> {
		const response = await linkOwnPaymentWallet({
			client: this.client,
			body: { purpose },
		});
		return response.data;
	}

	public async unlink(purpose: PaymentWalletPurpose): Promise<void> {
		await unlinkPaymentWallet({ client: this.client, path: { purpose } });
	}
}
