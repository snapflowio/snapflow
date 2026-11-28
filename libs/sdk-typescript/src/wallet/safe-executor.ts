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

import type { Address, Hash } from 'viem';
import {
	confirmTransaction,
	type EscrowExecutor,
	type EscrowPublicClient,
} from '../settlement/escrow-transaction.js';
import type { ContractCall } from './wallet-call.js';

export type SafeRelay = (calls: readonly ContractCall[]) => Promise<Hash>;

export interface SafeExecutorOptions {
	safeAddress: Address;
	chainId: number;
	publicClient: EscrowPublicClient;
	relay: SafeRelay;
}

export function safeExecutor({
	safeAddress,
	chainId,
	publicClient,
	relay,
}: SafeExecutorOptions): EscrowExecutor {
	return {
		account: safeAddress,
		chainId,
		async execute(steps) {
			const hash = await relay(steps.map(({ to, data }) => ({ to, data })));
			return [await confirmTransaction(publicClient, async () => hash)];
		},
	};
}
