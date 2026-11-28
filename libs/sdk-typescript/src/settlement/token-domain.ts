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
	parseAbi,
} from 'viem';
import type { EscrowPublicClient } from './escrow-transaction.js';

const MISSING_EIP712_DOMAIN_ERROR = 'Eip712DomainNotFoundError';

const erc20VersionAbi = parseAbi(['function version() view returns (string)']);

export interface TokenDomain {
	name: string;
	version: string;
	chainId: number;
	verifyingContract: Address;
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

export async function tokenDomain(
	publicClient: EscrowPublicClient,
	token: Address
): Promise<TokenDomain> {
	const domain = { chainId: publicClient.chain.id, verifyingContract: token };
	try {
		const { domain: declared } = await publicClient.getEip712Domain({
			address: token,
		});
		return { ...domain, name: declared.name, version: declared.version };
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
			abi: erc20VersionAbi,
			functionName: 'version',
		}),
	]);
	return { ...domain, name, version };
}
