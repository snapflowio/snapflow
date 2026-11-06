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
	BaseError,
	ContractFunctionRevertedError,
	ContractFunctionZeroDataError,
	erc20Abi,
	type Hex,
	parseAbi,
	parseSignature,
} from 'viem';
import type {
	EscrowPublicClient,
	EscrowWalletClient,
} from './escrow-transaction.js';

const SECONDS_PER_MINUTE = 60n;
const PERMIT_LIFETIME_MINUTES = 30n;
/** How long a signed permit stays usable, counted from the latest block. */
export const PERMIT_LIFETIME_SECONDS =
	PERMIT_LIFETIME_MINUTES * SECONDS_PER_MINUTE;
/** ECDSA recovery ids 0 and 1 are encoded as v = 27 and 28. */
const SIGNATURE_V_OFFSET = 27;
const MISSING_EIP712_DOMAIN_ERROR = 'Eip712DomainNotFoundError';

const erc20PermitAbi = parseAbi([
	'function nonces(address owner) view returns (uint256)',
	'function version() view returns (string)',
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

function lacksEip5267(error: unknown): boolean {
	return (
		error instanceof BaseError &&
		(error.name === MISSING_EIP712_DOMAIN_ERROR ||
			error.walk(
				(cause) =>
					cause instanceof ContractFunctionRevertedError ||
					cause instanceof ContractFunctionZeroDataError
			) !== null)
	);
}

/**
 * The token's EIP-712 name and version: from EIP-5267 `eip712Domain()` when
 * the token implements it, otherwise from `name()` and `version()` as
 * Circle's USDC exposes them.
 */
async function permitNameAndVersion(
	publicClient: EscrowPublicClient,
	token: Address
): Promise<{ name: string; version: string }> {
	try {
		const { domain } = await publicClient.getEip712Domain({ address: token });
		return { name: domain.name, version: domain.version };
	} catch (error) {
		if (!lacksEip5267(error)) throw error;
	}
	const [name, version] = await Promise.all([
		publicClient.readContract({
			address: token,
			abi: erc20Abi,
			functionName: 'name',
		}),
		publicClient.readContract({
			address: token,
			abi: erc20PermitAbi,
			functionName: 'version',
		}),
	]);
	return { name, version };
}

/** Signs an EIP-2612 permit letting `spender` move `value` of the wallet's tokens. */
export async function signPermit(
	walletClient: EscrowWalletClient,
	publicClient: EscrowPublicClient,
	token: Address,
	spender: Address,
	value: bigint
): Promise<SignedPermit> {
	const owner = walletClient.account.address;
	const [{ name, version }, nonce, block] = await Promise.all([
		permitNameAndVersion(publicClient, token),
		publicClient.readContract({
			address: token,
			abi: erc20PermitAbi,
			functionName: 'nonces',
			args: [owner],
		}),
		publicClient.getBlock(),
	]);
	const deadline = block.timestamp + PERMIT_LIFETIME_SECONDS;
	const signature = await walletClient.signTypedData({
		account: walletClient.account,
		domain: {
			name,
			version,
			chainId: publicClient.chain.id,
			verifyingContract: token,
		},
		types: permitTypes,
		primaryType: 'Permit',
		message: { owner, spender, value, nonce, deadline },
	});
	const { r, s, yParity } = parseSignature(signature);
	return { deadline, v: yParity + SIGNATURE_V_OFFSET, r, s };
}
