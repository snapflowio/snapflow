/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { getLogsRetryHelper } from '@ponder/utils';
import { hexToBigInt, numberToHex, type RpcError } from 'viem';
import type { BlockRange } from './block-range.util';

const HTTP_PAYLOAD_TOO_LARGE = 413;
const MAXIMUM_CAUSE_DEPTH = 8;
const TOO_LARGE_PATTERNS = [
	/payload too large/i,
	/request entity too large/i,
	/response (size|is) too (large|big)/i,
	/too many (results|logs)/i,
];

export type LogRangeNarrowing = Readonly<{
	blocks: bigint;
	providerLimit: boolean;
}>;

export function blockCount(range: BlockRange): bigint {
	return range.toBlock - range.fromBlock + 1n;
}

export function narrowedLogRange(
	error: unknown,
	range: BlockRange
): LogRangeNarrowing | null {
	const span = blockCount(range);
	if (span <= 1n) return null;
	for (const candidate of errorChain(error)) {
		const suggestion = suggestedRange(candidate, range);
		if (suggestion) {
			return {
				blocks: clamp(suggestion.blocks, span),
				providerLimit: suggestion.providerLimit,
			};
		}
	}
	if (errorChain(error).some(isTooLarge)) {
		return { blocks: clamp(span / 2n, span), providerLimit: false };
	}
	return null;
}

function suggestedRange(
	error: unknown,
	range: BlockRange
): LogRangeNarrowing | null {
	const result = getLogsRetryHelper({
		params: [
			{
				fromBlock: numberToHex(range.fromBlock),
				toBlock: numberToHex(range.toBlock),
			},
		],
		error: error as RpcError,
	});
	const first = result.shouldRetry ? result.ranges[0] : undefined;
	if (!result.shouldRetry || !first) return null;
	return {
		blocks: hexToBigInt(first.toBlock) - hexToBigInt(first.fromBlock) + 1n,
		providerLimit: result.isSuggestedRange,
	};
}

function isTooLarge(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	if (
		'status' in error &&
		(error as { status?: unknown }).status === HTTP_PAYLOAD_TOO_LARGE
	) {
		return true;
	}
	return TOO_LARGE_PATTERNS.some((pattern) => pattern.test(error.message));
}

function errorChain(error: unknown): unknown[] {
	const chain: unknown[] = [];
	let current: unknown = error;
	while (current && chain.length < MAXIMUM_CAUSE_DEPTH) {
		chain.push(current);
		current = current instanceof Error ? current.cause : undefined;
	}
	return chain;
}

function clamp(blocks: bigint, span: bigint): bigint {
	if (blocks < 1n) return 1n;
	return blocks < span ? blocks : span - 1n;
}
