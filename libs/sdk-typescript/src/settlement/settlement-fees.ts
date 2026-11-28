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

import { getBillingConfig, getPublicConfig } from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import {
	type ChannelTerms,
	feeBpsForMarkup,
	MAX_FEE_BPS,
} from '@snapflow/contracts';
import { getAddress } from 'viem';
import { SnapflowValidationError } from '../errors/snapflow-error.js';

export type SettlementFees = Pick<ChannelTerms, 'feeReceiver' | 'feeBps'>;

export function assertFeeBps(feeBps: number, name: string): void {
	if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > MAX_FEE_BPS) {
		throw new SnapflowValidationError(
			`${name} must be an integer between 0 and ${MAX_FEE_BPS}, got ${feeBps}`
		);
	}
}

export async function fetchChargedFeeBps(
	client: Client,
	signal?: AbortSignal
): Promise<number> {
	const { data } = await getBillingConfig({ client, signal });
	const feeBps = feeBpsForMarkup(data.markupBasisPoints);
	assertFeeBps(feeBps, 'The fee Snapflow charges');
	return feeBps;
}

export async function fetchSettlementFees(
	client: Client,
	signal?: AbortSignal
): Promise<SettlementFees> {
	const [feeBps, { data }] = await Promise.all([
		fetchChargedFeeBps(client, signal),
		getPublicConfig({ client, signal }),
	]);
	return {
		feeReceiver: getAddress(data.settlement.feeReceiverAddress),
		feeBps,
	};
}
