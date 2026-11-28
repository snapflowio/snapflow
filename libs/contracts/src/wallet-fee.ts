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
	type Address,
	decodeFunctionData,
	encodeFunctionData,
	erc20Abi,
	isAddressEqual,
} from 'viem';
import {
	multiSendCallOnlyAbi,
	multiSendCallOnlyAddress,
} from './generated/safe.abi.js';
import {
	decodeMultiSendTransactions,
	encodeMultiSend,
	type MultiSendCall,
	type SafeCall,
	SafeOperation,
	type SafeOperationCall,
} from './safe-transaction.js';

export type BatchedCall = Omit<MultiSendCall, 'operation'>;

export interface WalletFeePayee {
	usdc: Address;
	relayer: Address;
}

export interface WalletFeeBatch {
	calls: MultiSendCall[];
	feeMicroUsd: bigint;
}

export function walletFeeTransfer(
	payee: WalletFeePayee,
	feeMicroUsd: bigint
): BatchedCall {
	return {
		to: payee.usdc,
		value: 0n,
		data: encodeFunctionData({
			abi: erc20Abi,
			functionName: 'transfer',
			args: [payee.relayer, feeMicroUsd],
		}),
	};
}

export function safeCallBatch(call: SafeCall): MultiSendCall[] {
	if (call.operation === SafeOperation.CALL) {
		return [{ ...call, operation: SafeOperation.CALL }];
	}
	if (!isAddressEqual(call.to, multiSendCallOnlyAddress)) {
		throw new Error('Delegate calls only reach MultiSendCallOnly');
	}
	const { args } = decodeFunctionData({
		abi: multiSendCallOnlyAbi,
		data: call.data,
	});
	return decodeMultiSendTransactions(args[0]);
}

export function batchedSafeCall(
	calls: readonly BatchedCall[]
): SafeOperationCall {
	const [only] = calls;
	if (calls.length === 1 && only) {
		return { ...only, operation: SafeOperation.CALL };
	}
	return {
		to: multiSendCallOnlyAddress,
		value: 0n,
		data: encodeMultiSend(calls),
		operation: SafeOperation.DELEGATE_CALL,
	};
}

export function feePaidSafeCall(
	calls: readonly BatchedCall[],
	payee: WalletFeePayee,
	feeMicroUsd: bigint
): SafeOperationCall {
	return batchedSafeCall([...calls, walletFeeTransfer(payee, feeMicroUsd)]);
}

export function walletFeeBatch(
	call: SafeCall,
	payee: WalletFeePayee
): WalletFeeBatch | null {
	if (call.operation !== SafeOperation.DELEGATE_CALL || call.value !== 0n) {
		return null;
	}
	let batch: MultiSendCall[];
	try {
		batch = safeCallBatch(call);
	} catch {
		return null;
	}
	const fee = batch.at(-1);
	if (
		batch.length < 2 ||
		!fee ||
		fee.operation !== SafeOperation.CALL ||
		fee.value !== 0n ||
		!isAddressEqual(fee.to, payee.usdc)
	) {
		return null;
	}
	let transfer: ReturnType<typeof decodeFunctionData<typeof erc20Abi>>;
	try {
		transfer = decodeFunctionData({ abi: erc20Abi, data: fee.data });
	} catch {
		return null;
	}
	if (transfer.functionName !== 'transfer') return null;
	const [, feeMicroUsd] = transfer.args;
	const exact = walletFeeTransfer(payee, feeMicroUsd).data;
	return exact.toLowerCase() === fee.data.toLowerCase()
		? { calls: batch.slice(0, -1), feeMicroUsd }
		: null;
}
