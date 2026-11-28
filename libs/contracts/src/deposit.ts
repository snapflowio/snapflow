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
import { encodeAbiParameters, type Hex, keccak256, toBytes } from 'viem';
import type { EscrowDomain } from './domain.js';

export const DEPOSIT_AUTHORIZATION_TAG = keccak256(
	toBytes('SnapflowEscrow.depositWithAuthorization')
);

const depositAuthorizationFields = [
	{ name: 'payer', type: 'address' },
	{ name: 'customer', type: 'address' },
	{ name: 'relayer', type: 'address' },
	{ name: 'amount', type: 'uint256' },
	{ name: 'relayFee', type: 'uint256' },
	{ name: 'validAfter', type: 'uint256' },
	{ name: 'validBefore', type: 'uint256' },
	{ name: 'salt', type: 'bytes32' },
] as const;

const depositNonceParameters = [
	{ name: 'tag', type: 'bytes32' },
	{ name: 'chainId', type: 'uint256' },
	{ name: 'escrow', type: 'address' },
	...depositAuthorizationFields,
] as const;

export type DepositAuthorization = TypedDataToPrimitiveTypes<{
	DepositAuthorization: typeof depositAuthorizationFields;
}>['DepositAuthorization'];

export function depositNonceOf(
	domain: EscrowDomain,
	deposit: DepositAuthorization
): Hex {
	return keccak256(
		encodeAbiParameters(depositNonceParameters, [
			DEPOSIT_AUTHORIZATION_TAG,
			BigInt(domain.chainId),
			domain.verifyingContract,
			deposit.payer,
			deposit.customer,
			deposit.relayer,
			deposit.amount,
			deposit.relayFee,
			deposit.validAfter,
			deposit.validBefore,
			deposit.salt,
		])
	);
}
