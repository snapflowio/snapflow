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

import type { Hex, LocalAccount } from 'viem';
import {
	generatePrivateKey,
	type PrivateKeyAccount,
	privateKeyToAccount,
} from 'viem/accounts';
import { SnapflowValidationError } from '../errors/snapflow-error.js';

export interface GeneratedSessionKey {
	/** Persist this yourself (for example in a secret store); the SDK never stores keys. */
	privateKey: Hex;
	account: PrivateKeyAccount;
}

/** A session key is either a private key or any viem local account, such as one backed by a KMS. */
export type SessionKeySource = Hex | LocalAccount;

/** Creates a new random session key for client-mode voucher signing. */
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
