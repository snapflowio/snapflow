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
	concat,
	encodeFunctionData,
	encodePacked,
	getContractAddress,
	type Hex,
	hexToBigInt,
	keccak256,
	pad,
	zeroAddress,
} from 'viem';
import {
	compatibilityFallbackHandlerAddress,
	daimoP256VerifierAddress,
	safeL2Abi,
	safeL2Address,
	safeProxyFactoryAddress,
} from './generated/safe.abi.js';
import { type SafeCall, SafeOperation } from './safe-transaction.js';

export const P256_PRECOMPILE_ADDRESS = 0x100n;

const VERIFIERS_PRECOMPILE_SHIFT = 160n;

export const PASSKEY_SIGNER_VERIFIERS =
	(P256_PRECOMPILE_ADDRESS << VERIFIERS_PRECOMPILE_SHIFT) |
	hexToBigInt(daimoP256VerifierAddress);

export const SAFE_OWNER_THRESHOLD = 1n;

export function addOwnerCall(safe: Address, owner: Address): SafeCall {
	return {
		to: safe,
		value: 0n,
		data: encodeFunctionData({
			abi: safeL2Abi,
			functionName: 'addOwnerWithThreshold',
			args: [owner, SAFE_OWNER_THRESHOLD],
		}),
		operation: SafeOperation.CALL,
	};
}

export type P256PublicKey = { x: bigint; y: bigint };

export function safeSetupInitializer(owners: readonly Address[]): Hex {
	return encodeFunctionData({
		abi: safeL2Abi,
		functionName: 'setup',
		args: [
			owners,
			SAFE_OWNER_THRESHOLD,
			zeroAddress,
			'0x',
			compatibilityFallbackHandlerAddress,
			zeroAddress,
			0n,
			zeroAddress,
		],
	});
}

export interface SafeAccountDeployment {
	proxyCreationCode: Hex;
	initializer: Hex;
	saltNonce: bigint;
}

export function safeAccountAddress({
	proxyCreationCode,
	initializer,
	saltNonce,
}: SafeAccountDeployment): Address {
	return getContractAddress({
		opcode: 'CREATE2',
		from: safeProxyFactoryAddress,
		salt: keccak256(
			encodePacked(['bytes32', 'uint256'], [keccak256(initializer), saltNonce])
		),
		bytecode: concat([proxyCreationCode, pad(safeL2Address)]),
	});
}
