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
	addRecoveryOwner,
	createRecoveryOwnerSiweNonce,
	createUserWallet,
	getUserWallet,
	getWalletTransaction,
	listWalletTransactions,
	type PreparedWalletTransaction,
	prepareRecoveryOwner,
	prepareWalletTransaction,
	type RecoveryOwner,
	RecoveryOwnerKind,
	type SiweProof,
	submitWalletTransaction,
	type UserWallet,
	type WalletTransaction,
	WalletTransactionStatus,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import type { SafeCall } from '@snapflow/contracts';
import { getAddress, type Hash, isAddressEqual, isHash } from 'viem';
import {
	SnapflowTimeoutError,
	SnapflowValidationError,
} from '../errors/snapflow-error.js';
import {
	SnapflowWalletCancelledError,
	SnapflowWalletError,
} from '../errors/wallet-error.js';
import type {
	EscrowExecutor,
	EscrowPublicClient,
} from '../settlement/escrow-transaction.js';
import { abortableDelay } from '../utils/async.js';
import { Deadline } from '../utils/timeout.js';
import { type PasskeySigner, signWithPasskey } from './passkey-signer.js';
import { type SiweSigner, siweProof } from './payment-wallet-service.js';
import { recoveryOwnerCall } from './recovery-owner.js';
import { safeExecutor } from './safe-executor.js';
import {
	assertPreparedFor,
	type ContractCall,
	type SafeTarget,
	safeCallOf,
	type VerifiedWalletTransaction,
	verifiedWalletTransaction,
	type WalletFeeLimits,
} from './wallet-call.js';

export const DEFAULT_WALLET_TRANSACTION_TIMEOUT_SECONDS = 300;
export const DEFAULT_WALLET_POLL_INTERVAL_MILLISECONDS = 2_000;

export interface WalletTransactionWaitOptions {
	timeout?: number;
	pollIntervalMilliseconds?: number;
	signal?: AbortSignal;
}

export interface WalletSubmitOptions extends WalletFeeLimits {
	target?: SafeTarget;
}

export interface RecoveryOwnerOptions extends WalletSubmitOptions {
	ownerWallet?: SiweSigner;
}

export type WalletExecuteOptions = WalletSubmitOptions &
	WalletTransactionWaitOptions;

export interface PreparedWalletCall {
	nonce: string;
	transaction: VerifiedWalletTransaction;
}

export type WalletFeeConfirmation = (
	prepared: PreparedWalletCall
) => Promise<boolean>;

export interface EscrowExecutorOptions extends WalletTransactionWaitOptions {
	confirmFee?: WalletFeeConfirmation;
}

export interface PreparedRecoveryOwner extends PreparedWalletCall {
	owner: RecoveryOwner;
}

const SETTLED_STATUSES: ReadonlySet<WalletTransactionStatus> = new Set([
	WalletTransactionStatus.Succeeded,
	WalletTransactionStatus.Failed,
]);

function settledHash(transaction: WalletTransaction): Hash {
	if (!(transaction.transactionHash && isHash(transaction.transactionHash))) {
		throw new SnapflowWalletError(
			`Wallet transaction ${transaction.id} settled without a chain transaction`,
			transaction
		);
	}
	return transaction.transactionHash;
}

function verifiedTransaction(
	prepared: PreparedWalletTransaction,
	call: SafeCall,
	{ target, ...limits }: WalletSubmitOptions
): VerifiedWalletTransaction {
	if (target) assertPreparedFor(prepared, target);
	return verifiedWalletTransaction(prepared, call, limits);
}

export class WalletService {
	constructor(private readonly client: Client) {}

	public async get(): Promise<UserWallet> {
		const response = await getUserWallet({ client: this.client });
		return response.data;
	}

	public async create(passkeyId?: string): Promise<UserWallet> {
		const response = await createUserWallet({
			client: this.client,
			body: { passkeyId },
		});
		return response.data;
	}

	public async transactions(): Promise<WalletTransaction[]> {
		const response = await listWalletTransactions({ client: this.client });
		return response.data;
	}

	public async transaction(transactionId: string): Promise<WalletTransaction> {
		const response = await getWalletTransaction({
			client: this.client,
			path: { transactionId },
		});
		return response.data;
	}

	public async prepare(
		calls: readonly ContractCall[],
		options: WalletSubmitOptions = {}
	): Promise<PreparedWalletCall> {
		const call = safeCallOf(calls);
		const prepared = await prepareWalletTransaction({
			client: this.client,
			body: { to: call.to, data: call.data, operation: call.operation },
		});
		return {
			nonce: prepared.data.nonce,
			transaction: verifiedTransaction(prepared.data, call, options),
		};
	}

	public async submitPrepared(
		prepared: PreparedWalletCall,
		signer: PasskeySigner
	): Promise<WalletTransaction> {
		const { transaction, nonce } = prepared;
		const { signature, passkeyId } = await signWithPasskey(
			signer,
			transaction.safeTxHash
		);
		const response = await submitWalletTransaction({
			client: this.client,
			body: {
				to: transaction.call.to,
				data: transaction.call.data,
				operation: transaction.call.operation,
				nonce,
				signature,
				signingPasskeyId: passkeyId,
			},
		});
		return response.data;
	}

	public async submit(
		calls: readonly ContractCall[],
		signer: PasskeySigner,
		options: WalletSubmitOptions = {}
	): Promise<WalletTransaction> {
		return this.submitPrepared(await this.prepare(calls, options), signer);
	}

	public async waitForTransaction(
		transactionId: string,
		options: WalletTransactionWaitOptions = {}
	): Promise<WalletTransaction> {
		const timeout =
			options.timeout ?? DEFAULT_WALLET_TRANSACTION_TIMEOUT_SECONDS;
		const interval =
			options.pollIntervalMilliseconds ??
			DEFAULT_WALLET_POLL_INTERVAL_MILLISECONDS;
		if (timeout < 0 || interval <= 0) {
			throw new SnapflowValidationError(
				'The timeout must not be negative and the poll interval must be positive'
			);
		}
		const deadline = Deadline.after(timeout);
		for (;;) {
			options.signal?.throwIfAborted();
			const transaction = await this.transaction(transactionId);
			if (SETTLED_STATUSES.has(transaction.status)) {
				if (transaction.status === WalletTransactionStatus.Failed) {
					throw new SnapflowWalletError(
						`Wallet transaction ${transactionId} failed: ${transaction.error ?? 'reverted'}`,
						transaction
					);
				}
				return transaction;
			}
			if (deadline.isExpired()) {
				throw new SnapflowTimeoutError(
					`Wallet transaction ${transactionId} was not mined within ${timeout} seconds`
				);
			}
			await abortableDelay(
				Math.min(interval, deadline.remainingMilliseconds() ?? interval),
				options.signal
			);
		}
	}

	public async execute(
		calls: readonly ContractCall[],
		signer: PasskeySigner,
		options: WalletExecuteOptions = {}
	): Promise<WalletTransaction> {
		const queued = await this.submit(calls, signer, options);
		return this.waitForTransaction(queued.id, options);
	}

	public async executePrepared(
		prepared: PreparedWalletCall,
		signer: PasskeySigner,
		options: WalletTransactionWaitOptions = {}
	): Promise<WalletTransaction> {
		const queued = await this.submitPrepared(prepared, signer);
		return this.waitForTransaction(queued.id, options);
	}

	public async prepareRecoveryOwner(
		owner: RecoveryOwner,
		options: WalletSubmitOptions = {}
	): Promise<PreparedRecoveryOwner> {
		const prepared = await prepareRecoveryOwner({
			client: this.client,
			body: owner,
		});
		return {
			owner,
			nonce: prepared.data.nonce,
			transaction: verifiedTransaction(
				prepared.data,
				recoveryOwnerCall(prepared.data, owner),
				options
			),
		};
	}

	public async addPreparedRecoveryOwner(
		prepared: PreparedRecoveryOwner,
		signer: PasskeySigner,
		ownerWallet?: SiweSigner
	): Promise<WalletTransaction> {
		const { owner, nonce, transaction } = prepared;
		const ownerProof = await this.recoveryOwnerProof(owner, ownerWallet);
		const { signature, passkeyId } = await signWithPasskey(
			signer,
			transaction.safeTxHash
		);
		const response = await addRecoveryOwner({
			client: this.client,
			body: {
				...owner,
				nonce,
				feeMicroUsd: transaction.feeMicroUsd.toString(),
				signature,
				signingPasskeyId: passkeyId,
				ownerProof,
			},
		});
		return response.data;
	}

	public async addRecoveryOwner(
		owner: RecoveryOwner,
		signer: PasskeySigner,
		{ ownerWallet, ...options }: RecoveryOwnerOptions = {}
	): Promise<WalletTransaction> {
		return this.addPreparedRecoveryOwner(
			await this.prepareRecoveryOwner(owner, options),
			signer,
			ownerWallet
		);
	}

	private async recoveryOwnerProof(
		owner: RecoveryOwner,
		wallet: SiweSigner | undefined
	): Promise<SiweProof | undefined> {
		if (owner.kind !== RecoveryOwnerKind.Wallet) return undefined;
		if (
			!(wallet && owner.address) ||
			!isAddressEqual(wallet.account.address, getAddress(owner.address))
		) {
			throw new SnapflowValidationError(
				'An existing wallet recovery owner must sign with that wallet to prove you control it'
			);
		}
		const nonce = await createRecoveryOwnerSiweNonce({ client: this.client });
		return siweProof(nonce.data, wallet);
	}

	public async escrowExecutor(
		signer: PasskeySigner,
		publicClient: EscrowPublicClient,
		{ confirmFee, ...options }: EscrowExecutorOptions = {}
	): Promise<EscrowExecutor> {
		const wallet = await this.get();
		if (wallet.chainId !== publicClient.chain.id) {
			throw new SnapflowValidationError(
				`The wallet is on chain ${wallet.chainId} but the public client on ${publicClient.chain.id}`
			);
		}
		return safeExecutor({
			safeAddress: getAddress(wallet.safeAddress),
			chainId: wallet.chainId,
			publicClient,
			relay: async (calls) => {
				const prepared = await this.prepare(calls, { target: wallet });
				const approval: Promise<boolean> = confirmFee
					? confirmFee(prepared)
					: Promise.resolve(true);
				if (!(await approval)) throw new SnapflowWalletCancelledError();
				return settledHash(
					await this.executePrepared(prepared, signer, options)
				);
			},
		});
	}
}
