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

import type { TypedDataToPrimitiveTypes } from 'abitype';
import {
	type Address,
	concat,
	encodeFunctionData,
	encodePacked,
	getAddress,
	type Hex,
	hashTypedData,
	hexToBigInt,
	hexToNumber,
	size,
	slice,
	zeroAddress,
} from 'viem';
import { multiSendCallOnlyAbi } from './generated/safe.abi.js';

export const SafeOperation = {
	CALL: 0,
	DELEGATE_CALL: 1,
} as const;

export type SafeOperation = (typeof SafeOperation)[keyof typeof SafeOperation];

export const SAFE_OPERATIONS: readonly SafeOperation[] =
	Object.values(SafeOperation);

export function isSafeOperation(value: number): value is SafeOperation {
	return SAFE_OPERATIONS.some((operation) => operation === value);
}

export const safeTransactionTypes = {
	SafeTx: [
		{ name: 'to', type: 'address' },
		{ name: 'value', type: 'uint256' },
		{ name: 'data', type: 'bytes' },
		{ name: 'operation', type: 'uint8' },
		{ name: 'safeTxGas', type: 'uint256' },
		{ name: 'baseGas', type: 'uint256' },
		{ name: 'gasPrice', type: 'uint256' },
		{ name: 'gasToken', type: 'address' },
		{ name: 'refundReceiver', type: 'address' },
		{ name: 'nonce', type: 'uint256' },
	],
} as const;

export type SafeTransaction = TypedDataToPrimitiveTypes<
	typeof safeTransactionTypes
>['SafeTx'];

export type SafeCall = Pick<
	SafeTransaction,
	'to' | 'value' | 'data' | 'operation'
>;

export type SafeOperationCall = Omit<SafeCall, 'operation'> & {
	operation: SafeOperation;
};

export function relayedSafeTransaction(
	call: SafeCall,
	nonce: bigint
): SafeTransaction {
	return {
		...call,
		safeTxGas: 0n,
		baseGas: 0n,
		gasPrice: 0n,
		gasToken: zeroAddress,
		refundReceiver: zeroAddress,
		nonce,
	};
}

export function safeTransactionTypedData(
	chainId: number,
	safe: Address,
	transaction: SafeTransaction
) {
	return {
		domain: { chainId, verifyingContract: safe },
		types: safeTransactionTypes,
		primaryType: 'SafeTx',
		message: transaction,
	} as const;
}

export function hashSafeTransaction(
	chainId: number,
	safe: Address,
	transaction: SafeTransaction
): Hex {
	return hashTypedData(safeTransactionTypedData(chainId, safe, transaction));
}

export interface MultiSendCall {
	operation: SafeOperation;
	to: Address;
	value: bigint;
	data: Hex;
}

const OPERATION_BYTES = 1;
const ADDRESS_BYTES = 20;
const WORD_BYTES = 32;
const CALL_HEADER_BYTES = OPERATION_BYTES + ADDRESS_BYTES + 2 * WORD_BYTES;

export function encodeMultiSend(
	calls: readonly Omit<MultiSendCall, 'operation'>[]
): Hex {
	return encodeFunctionData({
		abi: multiSendCallOnlyAbi,
		functionName: 'multiSend',
		args: [
			concat(
				calls.map(({ to, value, data }) =>
					encodePacked(
						['uint8', 'address', 'uint256', 'uint256', 'bytes'],
						[SafeOperation.CALL, to, value, BigInt(size(data)), data]
					)
				)
			),
		],
	});
}

export function decodeMultiSendTransactions(
	transactions: Hex
): MultiSendCall[] {
	const calls: MultiSendCall[] = [];
	const total = size(transactions);
	let offset = 0;
	while (offset < total) {
		if (offset + CALL_HEADER_BYTES > total) {
			throw new Error('MultiSend transactions end inside a call header');
		}
		const operation = hexToNumber(
			slice(transactions, offset, offset + OPERATION_BYTES, { strict: true })
		);
		if (!isSafeOperation(operation)) {
			throw new Error(`MultiSend call has unknown operation ${operation}`);
		}
		const toStart = offset + OPERATION_BYTES;
		const valueStart = toStart + ADDRESS_BYTES;
		const lengthStart = valueStart + WORD_BYTES;
		const dataStart = lengthStart + WORD_BYTES;
		const dataLength = Number(
			hexToBigInt(slice(transactions, lengthStart, dataStart, { strict: true }))
		);
		const dataEnd = dataStart + dataLength;
		if (dataEnd > total) {
			throw new Error('MultiSend call data runs past the transactions');
		}
		calls.push({
			operation,
			to: getAddress(
				slice(transactions, toStart, valueStart, { strict: true })
			),
			value: hexToBigInt(
				slice(transactions, valueStart, lengthStart, { strict: true })
			),
			data:
				dataLength === 0
					? '0x'
					: slice(transactions, dataStart, dataEnd, { strict: true }),
		});
		offset = dataEnd;
	}
	return calls;
}
