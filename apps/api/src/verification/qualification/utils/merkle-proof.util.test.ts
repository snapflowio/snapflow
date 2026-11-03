/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	merkleInclusionPath,
	merkleTreeRoot,
} from '../testing/benchmark.fixtures';
import { verifyMerkleInclusion } from './merkle-proof.util';
import { uint32BigEndian } from './nonce-stream.util';

const MAXIMUM_TREE_SIZE = 17;

function leaves(count: number): Buffer[] {
	return Array.from(Array(count).keys(), (index) => uint32BigEndian(index));
}

describe('verifyMerkleInclusion', () => {
	it('accepts every leaf of RFC 9162 trees of every size', () => {
		for (let size = 1; size <= MAXIMUM_TREE_SIZE; size += 1) {
			const data = leaves(size);
			const root = merkleTreeRoot(data);
			for (let index = 0; index < size; index += 1) {
				assert.equal(
					verifyMerkleInclusion({
						leafIndex: BigInt(index),
						treeSize: BigInt(size),
						leafData: data[index],
						path: merkleInclusionPath(index, data),
						root,
					}),
					true,
					`size ${size} index ${index}`
				);
			}
		}
	});

	it('rejects a tampered leaf, path, size or index', () => {
		const data = leaves(11);
		const root = merkleTreeRoot(data);
		const path = merkleInclusionPath(6, data);
		const valid = {
			leafIndex: 6n,
			treeSize: 11n,
			leafData: data[6],
			path,
			root,
		};
		assert.equal(verifyMerkleInclusion(valid), true);
		assert.equal(verifyMerkleInclusion({ ...valid, leafData: data[5] }), false);
		assert.equal(
			verifyMerkleInclusion({ ...valid, path: [...path].reverse() }),
			false
		);
		assert.equal(verifyMerkleInclusion({ ...valid, treeSize: 7n }), false);
		assert.equal(verifyMerkleInclusion({ ...valid, leafIndex: 7n }), false);
		assert.equal(verifyMerkleInclusion({ ...valid, leafIndex: 11n }), false);
		assert.equal(
			verifyMerkleInclusion({ ...valid, path: path.slice(1) }),
			false
		);
	});

	it('distinguishes leaf hashes from node hashes', () => {
		const data = leaves(2);
		const root = merkleTreeRoot(data);
		assert.notDeepEqual(root, merkleTreeRoot([Buffer.concat(data)]));
	});
});
