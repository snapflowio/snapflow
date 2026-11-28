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
	PreparedWalletTransaction,
	UserWallet,
} from '@snapflow/api-client';
import {
	batchedSafeCall,
	feePaidSafeCall,
	hashSafeTransaction,
	relayedSafeTransaction,
	type SafeCall,
	type SafeOperationCall,
	safeCallBatch,
	type WalletFeeBatch,
	type WalletFeePayee,
	walletFeeBatch,
} from '@snapflow/contracts';
import {
	type Address,
	encodeFunctionData,
	erc20Abi,
	getAddress,
	type Hash,
	isAddressEqual,
	isHash,
} from 'viem';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import { SnapflowWalletError } from '../errors/wallet-error.js';
import { hexOfSize, unsigned } from '../settlement/delegation.js';

export type ContractCall = Pick<SafeCall, 'to' | 'data'>;

export type { SafeOperationCall } from '@snapflow/contracts';

const RELAYED_VALUE = 0n;

export function safeCallOf(calls: readonly ContractCall[]): SafeOperationCall {
	if (calls.length === 0) {
		throw new SnapflowValidationError('A wallet transaction needs a call');
	}
	return batchedSafeCall(
		calls.map((call) => ({ ...call, value: RELAYED_VALUE }))
	);
}

export function usdcTransfer(
	usdcAddress: Address,
	recipient: Address,
	amount: bigint
): ContractCall {
	if (amount <= 0n) {
		throw new SnapflowValidationError('amount must be positive');
	}
	return {
		to: usdcAddress,
		data: encodeFunctionData({
			abi: erc20Abi,
			functionName: 'transfer',
			args: [recipient, amount],
		}),
	};
}

export function preparedCall(
	prepared: PreparedWalletTransaction
): SafeOperationCall {
	return {
		to: getAddress(prepared.to),
		value: unsigned(prepared.value, 'value'),
		data: hexOfSize(prepared.data, 'call data'),
		operation: prepared.operation,
	};
}

export interface WalletFeeLimits {
	feePayee?: WalletFeePayee;
	maxFeeMicroUsd?: bigint;
}

function refused(reason: string): SnapflowWalletError {
	return new SnapflowWalletError(`${reason}; nothing was signed`);
}

function preparedFeePayee(
	prepared: PreparedWalletTransaction,
	{ feePayee }: WalletFeeLimits
): WalletFeePayee {
	const payee = {
		usdc: getAddress(prepared.feeToken),
		relayer: getAddress(prepared.feeRecipient),
	};
	if (
		feePayee &&
		!(
			isAddressEqual(payee.usdc, feePayee.usdc) &&
			isAddressEqual(payee.relayer, feePayee.relayer)
		)
	) {
		throw refused('Snapflow prepared a fee to another relayer or token');
	}
	return payee;
}

export function preparedFeeBatch(
	prepared: PreparedWalletTransaction,
	limits: WalletFeeLimits = {}
): WalletFeeBatch {
	const batch = walletFeeBatch(
		preparedCall(prepared),
		preparedFeePayee(prepared, limits)
	);
	const feeMicroUsd = unsigned(prepared.feeMicroUsd, 'feeMicroUsd');
	if (!batch || batch.feeMicroUsd !== feeMicroUsd) {
		throw refused(
			'Snapflow prepared a transaction that does not end in its quoted USDC fee to the relayer'
		);
	}
	if (
		limits.maxFeeMicroUsd !== undefined &&
		feeMicroUsd > limits.maxFeeMicroUsd
	) {
		throw refused(
			`The fee of ${feeMicroUsd} USDC base units is above the ${limits.maxFeeMicroUsd} allowed`
		);
	}
	return batch;
}

export interface VerifiedWalletTransaction {
	call: SafeOperationCall;
	safeTxHash: Hash;
	feeMicroUsd: bigint;
}

export function verifiedWalletTransaction(
	prepared: PreparedWalletTransaction,
	call: SafeCall,
	limits: WalletFeeLimits = {}
): VerifiedWalletTransaction {
	const { feeMicroUsd } = preparedFeeBatch(prepared, limits);
	const signed = feePaidSafeCall(
		safeCallBatch(call),
		preparedFeePayee(prepared, limits),
		feeMicroUsd
	);
	const safeTxHash = hashSafeTransaction(
		prepared.chainId,
		getAddress(prepared.safeAddress),
		relayedSafeTransaction(signed, unsigned(prepared.nonce, 'nonce'))
	);
	const returned = preparedCall(prepared);
	if (
		!isHash(prepared.safeTxHash) ||
		safeTxHash !== prepared.safeTxHash.toLowerCase() ||
		returned.data.toLowerCase() !== signed.data.toLowerCase() ||
		!isAddressEqual(returned.to, signed.to) ||
		returned.operation !== signed.operation
	) {
		throw refused(
			'Snapflow prepared another transaction than the one requested'
		);
	}
	return { call: returned, safeTxHash, feeMicroUsd };
}

export type SafeTarget = Pick<UserWallet, 'chainId' | 'safeAddress'>;

export function assertPreparedFor(
	prepared: PreparedWalletTransaction,
	target: SafeTarget
): void {
	if (
		prepared.chainId !== target.chainId ||
		!isAddressEqual(
			getAddress(prepared.safeAddress),
			getAddress(target.safeAddress)
		)
	) {
		throw new SnapflowWalletError(
			'Snapflow prepared a transaction for another Safe or chain; nothing was signed'
		);
	}
}
