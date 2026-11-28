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

import { type Address, type Hex, parseAbi, parseSignature } from 'viem';
import { SECONDS_PER_MINUTE } from '../utils/timeout.js';
import type {
	EscrowPublicClient,
	EscrowWalletClient,
} from './escrow-transaction.js';
import { tokenDomain } from './token-domain.js';

const PERMIT_LIFETIME_MINUTES = 30n;
export const PERMIT_LIFETIME_SECONDS =
	PERMIT_LIFETIME_MINUTES * BigInt(SECONDS_PER_MINUTE);
const SIGNATURE_V_OFFSET = 27;

const erc20NoncesAbi = parseAbi([
	'function nonces(address owner) view returns (uint256)',
]);

const permitTypes = {
	Permit: [
		{ name: 'owner', type: 'address' },
		{ name: 'spender', type: 'address' },
		{ name: 'value', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
} as const;

export interface SignedPermit {
	deadline: bigint;
	v: number;
	r: Hex;
	s: Hex;
}

export async function signPermit(
	walletClient: EscrowWalletClient,
	publicClient: EscrowPublicClient,
	token: Address,
	spender: Address,
	value: bigint
): Promise<SignedPermit> {
	const owner = walletClient.account.address;
	const [domain, nonce, block] = await Promise.all([
		tokenDomain(publicClient, token),
		publicClient.readContract({
			address: token,
			abi: erc20NoncesAbi,
			functionName: 'nonces',
			args: [owner],
		}),
		publicClient.getBlock(),
	]);
	const deadline = block.timestamp + PERMIT_LIFETIME_SECONDS;
	const signature = await walletClient.signTypedData({
		account: walletClient.account,
		domain,
		types: permitTypes,
		primaryType: 'Permit',
		message: { owner, spender, value, nonce, deadline },
	});
	const { r, s, yParity } = parseSignature(signature);
	return { deadline, v: yParity + SIGNATURE_V_OFFSET, r, s };
}
