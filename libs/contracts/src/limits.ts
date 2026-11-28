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

export const BPS_DENOMINATOR = 10_000;

export const MAX_FEE_BPS = 3000;

export const MAX_RELAY_FEE = 1_000_000n;

export const MAX_BATCH_SIZE = 20;

export const BATCH_ITEM_GAS = 500_000n;

const CALL_GAS_RETAINED_DIVISOR = 64n;

export function batchItemsGas(items: number): bigint {
	const perItem =
		(BATCH_ITEM_GAS * CALL_GAS_RETAINED_DIVISOR +
			CALL_GAS_RETAINED_DIVISOR -
			2n) /
		(CALL_GAS_RETAINED_DIVISOR - 1n);
	return perItem * BigInt(items);
}

export const SIGNER_BURST_HOURS = 24n;

export const SECONDS_PER_HOUR = 3600n;

export const MAX_BLOCK_DURATION = 7_776_000;

export const MIN_AUTO_TOP_UP_INTERVAL = 3600;

export function feeOf(paid: bigint, feeBps: number): bigint {
	return (paid * BigInt(feeBps)) / BigInt(BPS_DENOMINATOR);
}

export function feeBpsForMarkup(markupBps: number): number {
	if (!Number.isSafeInteger(markupBps) || markupBps < 0) {
		throw new RangeError(
			`markupBps must be a non-negative integer, got ${markupBps}`
		);
	}
	return Math.floor(
		(markupBps * BPS_DENOMINATOR) / (BPS_DENOMINATOR + markupBps)
	);
}
