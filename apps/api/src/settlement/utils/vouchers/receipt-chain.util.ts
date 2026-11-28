/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	encodeAbiParameters,
	type Hex,
	isHex,
	keccak256,
	size,
	zeroHash,
} from 'viem';

const BYTES32 = 32;

const RECEIPT_HEADS = [{ type: 'bytes32[]' }] as const;

export function receiptDigestWord(digest: string): Hex {
	const word = `0x${digest}` as const;
	if (!isHex(word, { strict: true }) || size(word) !== BYTES32) {
		throw new Error(`Receipt digest ${digest} is not 32 bytes of hex`);
	}
	return word;
}

export function receiptHeadsMetadata(heads: readonly Hex[]): Hex {
	const [only] = heads;
	if (heads.length === 0) return zeroHash;
	if (heads.length === 1 && only) return only;
	return keccak256(encodeAbiParameters(RECEIPT_HEADS, [heads]));
}
