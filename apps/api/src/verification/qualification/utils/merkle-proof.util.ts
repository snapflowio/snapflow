/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BENCHMARK_PROTOCOL } from '../constants/benchmark-policy.constants';
import { sha256 } from './nonce-stream.util';

const LEAF_DOMAIN = 0x00;
const NODE_DOMAIN = 0x01;
const LEAF_PREFIX = Uint8Array.of(LEAF_DOMAIN);
const NODE_PREFIX = Uint8Array.of(NODE_DOMAIN);

export interface MerkleInclusion {
	leafIndex: bigint;
	treeSize: bigint;
	leafData: Uint8Array;
	path: readonly Uint8Array[];
	root: Uint8Array;
}

export function merkleLeafHash(leafData: Uint8Array): Buffer {
	return sha256(LEAF_PREFIX, leafData);
}

export function merkleNodeHash(left: Uint8Array, right: Uint8Array): Buffer {
	return sha256(NODE_PREFIX, left, right);
}

interface MerkleCursor {
	index: bigint;
	last: bigint;
	hash: Buffer;
}

function isRightChild({ index, last }: MerkleCursor): boolean {
	return (index & 1n) === 1n || index === last;
}

function climb(cursor: MerkleCursor, sibling: Uint8Array): MerkleCursor {
	if (!isRightChild(cursor)) {
		return {
			index: cursor.index >> 1n,
			last: cursor.last >> 1n,
			hash: merkleNodeHash(cursor.hash, sibling),
		};
	}
	let { index, last } = cursor;
	while ((index & 1n) === 0n && index !== 0n) {
		index >>= 1n;
		last >>= 1n;
	}
	return {
		index: index >> 1n,
		last: last >> 1n,
		hash: merkleNodeHash(sibling, cursor.hash),
	};
}

export function verifyMerkleInclusion({
	leafIndex,
	treeSize,
	leafData,
	path,
	root,
}: MerkleInclusion): boolean {
	if (
		leafIndex < 0n ||
		leafIndex >= treeSize ||
		root.length !== BENCHMARK_PROTOCOL.DIGEST_BYTES
	) {
		return false;
	}
	let cursor: MerkleCursor = {
		index: leafIndex,
		last: treeSize - 1n,
		hash: merkleLeafHash(leafData),
	};
	for (const sibling of path) {
		if (
			cursor.last === 0n ||
			sibling.length !== BENCHMARK_PROTOCOL.DIGEST_BYTES
		) {
			return false;
		}
		cursor = climb(cursor, sibling);
	}
	return cursor.last === 0n && cursor.hash.equals(root);
}
