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
	type DepositAuthorization,
	depositNonceOf,
	type EscrowDomain,
} from '@snapflow/contracts';
import { type Address, bytesToHex, type Hex } from 'viem';
import { SECONDS_PER_MINUTE } from '../utils/timeout.js';
import type {
	EscrowPublicClient,
	EscrowWalletClient,
} from './escrow-transaction.js';
import { tokenDomain } from './token-domain.js';

const DEPOSIT_AUTHORIZATION_LIFETIME_MINUTES = 60n;
export const DEPOSIT_AUTHORIZATION_LIFETIME_SECONDS =
	DEPOSIT_AUTHORIZATION_LIFETIME_MINUTES * BigInt(SECONDS_PER_MINUTE);
const VALID_FROM_START = 0n;
const SALT_BYTES = 32;

const receiveWithAuthorizationTypes = {
	ReceiveWithAuthorization: [
		{ name: 'from', type: 'address' },
		{ name: 'to', type: 'address' },
		{ name: 'value', type: 'uint256' },
		{ name: 'validAfter', type: 'uint256' },
		{ name: 'validBefore', type: 'uint256' },
		{ name: 'nonce', type: 'bytes32' },
	],
} as const;

export interface SignedDepositAuthorization extends DepositAuthorization {
	signature: Hex;
}

export interface DepositAuthorizationRequest {
	escrow: EscrowDomain;
	usdc: Address;
	customer: Address;
	relayer: Address;
	amount: bigint;
	relayFee: bigint;
	lifetimeSeconds: bigint;
}

function randomSalt(): Hex {
	return bytesToHex(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
}

export async function signDepositAuthorization(
	walletClient: EscrowWalletClient,
	publicClient: EscrowPublicClient,
	request: DepositAuthorizationRequest
): Promise<SignedDepositAuthorization> {
	const [domain, block] = await Promise.all([
		tokenDomain(publicClient, request.usdc),
		publicClient.getBlock(),
	]);
	const deposit: DepositAuthorization = {
		payer: walletClient.account.address,
		customer: request.customer,
		relayer: request.relayer,
		amount: request.amount,
		relayFee: request.relayFee,
		validAfter: VALID_FROM_START,
		validBefore: block.timestamp + request.lifetimeSeconds,
		salt: randomSalt(),
	};
	const signature = await walletClient.signTypedData({
		account: walletClient.account,
		domain,
		types: receiveWithAuthorizationTypes,
		primaryType: 'ReceiveWithAuthorization',
		message: {
			from: deposit.payer,
			to: request.escrow.verifyingContract,
			value: deposit.amount,
			validAfter: deposit.validAfter,
			validBefore: deposit.validBefore,
			nonce: depositNonceOf(request.escrow, deposit),
		},
	});
	return { ...deposit, signature };
}
