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
	encodePacked,
	type Hex,
	hashMessage,
	keccak256,
	recoverMessageAddress,
	type SignableMessage,
} from 'viem';
import type { EscrowDomain } from './domain.js';
import { assertEscrowSignature } from './signature.js';

export const SIGNER_PROOF_TAG = 'authorizeSignerProof';

const SIGNER_PROOF_TYPES = [
	'uint256',
	'address',
	'string',
	'uint256',
	'address',
] as const;

export function signerProofMessage(
	domain: EscrowDomain,
	deadline: bigint,
	customer: Address
): SignableMessage {
	return {
		raw: keccak256(
			encodePacked(SIGNER_PROOF_TYPES, [
				BigInt(domain.chainId),
				domain.verifyingContract,
				SIGNER_PROOF_TAG,
				deadline,
				customer,
			])
		),
	};
}

export function hashSignerProof(
	domain: EscrowDomain,
	deadline: bigint,
	customer: Address
): Hex {
	return hashMessage(signerProofMessage(domain, deadline, customer));
}

export async function recoverSignerProofSigner(
	domain: EscrowDomain,
	deadline: bigint,
	customer: Address,
	signature: Hex
): Promise<Address> {
	assertEscrowSignature(signature);
	return recoverMessageAddress({
		message: signerProofMessage(domain, deadline, customer),
		signature,
	});
}
