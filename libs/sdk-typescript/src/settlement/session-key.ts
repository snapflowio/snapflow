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

import { type EscrowDomain, signerProofMessage } from '@snapflow/contracts';
import type { Address, Hex, LocalAccount } from 'viem';
import {
	generatePrivateKey,
	type PrivateKeyAccount,
	privateKeyToAccount,
} from 'viem/accounts';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import { SECONDS_PER_MINUTE } from '../utils/timeout.js';
import type { SignerAuthorization, SignerScope } from './escrow-types.js';

const SIGNER_PROOF_LIFETIME_MINUTES = 30n;
export const SIGNER_PROOF_LIFETIME_SECONDS =
	SIGNER_PROOF_LIFETIME_MINUTES * BigInt(SECONDS_PER_MINUTE);

export interface GeneratedSessionKey {
	privateKey: Hex;
	account: PrivateKeyAccount;
}

export type SessionKeySource = Hex | LocalAccount;

export function generateSessionKey(): GeneratedSessionKey {
	const privateKey = generatePrivateKey();
	return { privateKey, account: privateKeyToAccount(privateKey) };
}

export function toSessionKeyAccount(key: SessionKeySource): LocalAccount {
	if (typeof key !== 'string') {
		return key;
	}
	try {
		return privateKeyToAccount(key);
	} catch (error) {
		throw new SnapflowValidationError(
			`Invalid session key: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

export async function sessionKeyAuthorization(
	key: SessionKeySource,
	escrow: EscrowDomain,
	customer: Address,
	scope: SignerScope,
	proofDeadline: bigint
): Promise<SignerAuthorization> {
	const account = toSessionKeyAccount(key);
	const proof = await account.signMessage({
		message: signerProofMessage(escrow, proofDeadline, customer),
	});
	return { signer: account.address, scope, proofDeadline, proof };
}
