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
	type Abi,
	type Account,
	type Address,
	BaseError,
	type Chain,
	decodeFunctionData,
	getContractError,
	type Hash,
	type Hex,
	type PublicClient,
	type TransactionReceipt,
	type Transport,
	type WalletClient,
} from 'viem';
import {
	SnapflowEscrowError,
	toEscrowError,
} from '../errors/settlement-error.js';

export type EscrowWalletClient = WalletClient<Transport, Chain, Account>;

export type EscrowPublicClient = PublicClient<Transport, Chain>;

export interface EscrowClients {
	walletClient: EscrowWalletClient;
	publicClient: EscrowPublicClient;
}

export interface EscrowStep {
	to: Address;
	data: Hex;
	abi: Abi;
}

export interface EscrowExecutor {
	readonly account: Address;
	readonly chainId: number;
	execute(steps: readonly EscrowStep[]): Promise<TransactionReceipt[]>;
}

export interface EscrowExecutorClients {
	executor: EscrowExecutor;
	publicClient: EscrowPublicClient;
}

const ATOMIC_BATCH_STATUSES: ReadonlySet<string> = new Set([
	'supported',
	'ready',
]);

export async function readChain<T>(read: () => Promise<T>): Promise<T> {
	try {
		return await read();
	} catch (error) {
		throw toEscrowError(error);
	}
}

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

async function simulateStep(
	{ walletClient, publicClient }: EscrowClients,
	{ to, data, abi }: EscrowStep
): Promise<void> {
	const { account } = walletClient;
	try {
		await publicClient.call({ account, to, data });
	} catch (error) {
		if (!(error instanceof BaseError)) throw error;
		const { functionName, args } = decodeFunctionData({ abi, data });
		throw getContractError(error, {
			abi,
			address: to,
			functionName,
			args,
			sender: account.address,
		});
	}
}

function sendStep(
	clients: EscrowClients,
	step: EscrowStep
): Promise<TransactionReceipt> {
	const { walletClient, publicClient } = clients;
	return confirmTransaction(publicClient, async () => {
		await simulateStep(clients, step);
		return walletClient.sendTransaction({
			account: walletClient.account,
			chain: walletClient.chain,
			to: step.to,
			data: step.data,
		});
	});
}

async function supportsAtomicBatch(
	walletClient: EscrowWalletClient
): Promise<boolean> {
	try {
		const capabilities = await walletClient.getCapabilities({
			account: walletClient.account,
			chainId: walletClient.chain.id,
		});
		const status = capabilities.atomic?.status;
		return status !== undefined && ATOMIC_BATCH_STATUSES.has(status);
	} catch (error) {
		if (error instanceof BaseError) return false;
		throw error;
	}
}

async function sendSteps(
	clients: EscrowClients,
	steps: readonly EscrowStep[]
): Promise<TransactionReceipt[]> {
	const { walletClient, publicClient } = clients;
	if (steps.length > 1 && (await supportsAtomicBatch(walletClient))) {
		const { id } = await readChain(() =>
			walletClient.sendCalls({
				account: walletClient.account,
				calls: steps.map(({ to, data }) => ({ to, data })),
				forceAtomic: true,
			})
		);
		const { receipts = [] } = await readChain(() =>
			walletClient.waitForCallsStatus({ id, throwOnFailure: true })
		);
		const hashes = new Set(receipts.map((receipt) => receipt.transactionHash));
		return Promise.all(
			[...hashes].map((hash) =>
				confirmTransaction(publicClient, async () => hash)
			)
		);
	}
	const sent: TransactionReceipt[] = [];
	for (const step of steps) {
		sent.push(await sendStep(clients, step));
	}
	return sent;
}

export function walletExecutor(clients: EscrowClients): EscrowExecutor {
	return {
		account: clients.walletClient.account.address,
		chainId: clients.walletClient.chain.id,
		execute: (steps) => sendSteps(clients, steps),
	};
}

export function lastReceipt(
	receipts: readonly TransactionReceipt[]
): TransactionReceipt {
	const receipt = receipts.at(-1);
	if (!receipt) {
		throw new SnapflowEscrowError('The execution sent no transaction', {});
	}
	return receipt;
}
