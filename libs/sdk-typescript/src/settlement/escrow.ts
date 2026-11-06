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

import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	type Address,
	type ContractFunctionReturnType,
	erc20Abi,
	type TransactionReceipt,
} from 'viem';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import { signPermit } from './escrow-permit.js';
import {
	confirmTransaction,
	type EscrowPublicClient,
	type EscrowWalletClient,
	readChain,
} from './escrow-transaction.js';

type WriteContractRequest = Parameters<EscrowWalletClient['writeContract']>[0];

type SessionKeyState = ContractFunctionReturnType<
	typeof snapflowEscrowAbi,
	'view',
	'sessionKeyOf'
>;

/** What a session key may sign for: USDC base units in total and per started hour, until `expiry` (unix seconds). */
export type SessionKeyLimits = Pick<
	SessionKeyState,
	'spendCap' | 'hourlyCap' | 'expiry'
>;

export type EscrowWithdrawal = ContractFunctionReturnType<
	typeof snapflowEscrowAbi,
	'view',
	'withdrawalOf'
>;

/** A funding wallet's escrow state as the contract reports it, in USDC base units. */
export interface EscrowBalance {
	balance: bigint;
	withdrawal: EscrowWithdrawal;
}

export interface EscrowClients {
	walletClient: EscrowWalletClient;
	publicClient: EscrowPublicClient;
}

export interface EscrowOptions extends EscrowClients {
	escrowAddress: Address;
	usdcAddress: Address;
}

export interface DepositOptions {
	/**
	 * Authorize the transfer with an EIP-2612 permit signature instead of an
	 * approval transaction. Needs a wallet that signs typed data with an
	 * externally owned account; smart-contract wallets should leave it off.
	 */
	permit?: boolean;
}

function assertPositive(amount: bigint, name: string): void {
	if (amount <= 0n) {
		throw new SnapflowValidationError(`${name} must be positive`);
	}
}

/**
 * The SnapflowEscrow contract driven from the customer's own wallet. Every
 * write waits for its receipt and rejects with a SnapflowEscrowError when the
 * wallet refuses it or the contract reverts.
 */
export class Escrow {
	public readonly escrowAddress: Address;
	public readonly usdcAddress: Address;
	private readonly walletClient: EscrowWalletClient;
	private readonly publicClient: EscrowPublicClient;

	constructor(options: EscrowOptions) {
		if (options.walletClient.chain.id !== options.publicClient.chain.id) {
			throw new SnapflowValidationError(
				`The wallet is on chain ${options.walletClient.chain.id} but the public client on ${options.publicClient.chain.id}`
			);
		}
		this.escrowAddress = options.escrowAddress;
		this.usdcAddress = options.usdcAddress;
		this.walletClient = options.walletClient;
		this.publicClient = options.publicClient;
	}

	public get chainId(): number {
		return this.publicClient.chain.id;
	}

	/** The funding wallet the transactions are sent from. */
	public get account(): Address {
		return this.walletClient.account.address;
	}

	/** Moves `amount` USDC from the wallet into its escrow balance. */
	public async deposit(
		amount: bigint,
		options: DepositOptions = {}
	): Promise<TransactionReceipt> {
		assertPositive(amount, 'amount');
		if (options.permit) {
			const permit = await readChain(() =>
				signPermit(
					this.walletClient,
					this.publicClient,
					this.usdcAddress,
					this.escrowAddress,
					amount
				)
			);
			return this.send(() =>
				this.publicClient.simulateContract({
					...this.escrowCall,
					functionName: 'depositWithPermit',
					args: [amount, permit.deadline, permit.v, permit.r, permit.s],
				})
			);
		}
		const allowance = await readChain(() =>
			this.publicClient.readContract({
				address: this.usdcAddress,
				abi: erc20Abi,
				functionName: 'allowance',
				args: [this.account, this.escrowAddress],
			})
		);
		if (allowance < amount) {
			await this.send(() =>
				this.publicClient.simulateContract({
					account: this.walletClient.account,
					address: this.usdcAddress,
					abi: erc20Abi,
					functionName: 'approve',
					args: [this.escrowAddress, amount],
				})
			);
		}
		return this.send(() =>
			this.publicClient.simulateContract({
				...this.escrowCall,
				functionName: 'deposit',
				args: [amount],
			})
		);
	}

	/** Lets `key` sign vouchers for this wallet within `limits`, replacing any earlier limits of that key. */
	public authorizeSessionKey(
		key: Address,
		limits: SessionKeyLimits
	): Promise<TransactionReceipt> {
		assertPositive(limits.spendCap, 'spendCap');
		assertPositive(limits.hourlyCap, 'hourlyCap');
		return this.send(() =>
			this.publicClient.simulateContract({
				...this.escrowCall,
				functionName: 'setSessionKey',
				args: [key, limits.spendCap, limits.hourlyCap, limits.expiry],
			})
		);
	}

	public revokeSessionKey(key: Address): Promise<TransactionReceipt> {
		return this.send(() =>
			this.publicClient.simulateContract({
				...this.escrowCall,
				functionName: 'revokeSessionKey',
				args: [key],
			})
		);
	}

	/** Starts the dispute window after which `withdraw()` pays out `amount`. */
	public requestWithdrawal(amount: bigint): Promise<TransactionReceipt> {
		assertPositive(amount, 'amount');
		return this.send(() =>
			this.publicClient.simulateContract({
				...this.escrowCall,
				functionName: 'requestWithdrawal',
				args: [amount],
			})
		);
	}

	public cancelWithdrawal(): Promise<TransactionReceipt> {
		return this.send(() =>
			this.publicClient.simulateContract({
				...this.escrowCall,
				functionName: 'cancelWithdrawal',
			})
		);
	}

	/** Pays out the requested withdrawal once its dispute window has passed. */
	public withdraw(): Promise<TransactionReceipt> {
		return this.send(() =>
			this.publicClient.simulateContract({
				...this.escrowCall,
				functionName: 'withdraw',
			})
		);
	}

	/** Reads a funding wallet's balance and pending withdrawal from the contract. */
	public async readBalance(
		owner: Address = this.account
	): Promise<EscrowBalance> {
		const [balance, withdrawal] = await readChain(() =>
			Promise.all([
				this.publicClient.readContract({
					...this.contract,
					functionName: 'balanceOf',
					args: [owner],
				}),
				this.publicClient.readContract({
					...this.contract,
					functionName: 'withdrawalOf',
					args: [owner],
				}),
			])
		);
		return { balance, withdrawal };
	}

	private get contract() {
		return { address: this.escrowAddress, abi: snapflowEscrowAbi } as const;
	}

	private get escrowCall() {
		return { ...this.contract, account: this.walletClient.account } as const;
	}

	/**
	 * Simulates the call first so a revert is reported with its decoded
	 * custom error, which wallets that estimate gas themselves do not report,
	 * then sends exactly the simulated request.
	 */
	private send(
		simulate: () => Promise<{ request: WriteContractRequest }>
	): Promise<TransactionReceipt> {
		return confirmTransaction(this.publicClient, async () => {
			const { request } = await simulate();
			return this.walletClient.writeContract(request);
		});
	}
}
