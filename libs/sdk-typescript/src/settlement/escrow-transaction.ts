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

import type {
	Account,
	Chain,
	Hash,
	PublicClient,
	TransactionReceipt,
	Transport,
	WalletClient,
} from 'viem';
import {
	SnapflowEscrowError,
	toEscrowError,
} from '../errors/settlement-error.js';

/** The customer's wallet: it must carry the account that funds the escrow and the settlement chain. */
export type EscrowWalletClient = WalletClient<Transport, Chain, Account>;

export type EscrowPublicClient = PublicClient<Transport, Chain>;

/** Runs a chain read, reporting its failure as a SnapflowEscrowError. */
export async function readChain<T>(read: () => Promise<T>): Promise<T> {
	try {
		return await read();
	} catch (error) {
		throw toEscrowError(error);
	}
}

/** Sends a transaction and waits for its receipt; a revert rejects with a SnapflowEscrowError. */
export async function confirmTransaction(
	publicClient: EscrowPublicClient,
	send: () => Promise<Hash>
): Promise<TransactionReceipt> {
	const hash = await readChain(send);
	let receipt: TransactionReceipt;
	try {
		receipt = await publicClient.waitForTransactionReceipt({ hash });
	} catch (error) {
		throw toEscrowError(error, hash);
	}
	if (receipt.status !== 'success') {
		throw new SnapflowEscrowError(`Transaction ${hash} reverted`, {
			transactionHash: hash,
		});
	}
	return receipt;
}
