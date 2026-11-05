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
import { BENCHMARK_LABEL } from '../constants/benchmark-policy.constants';
import { TEST_NONCE } from '../testing/benchmark.fixtures';
import {
	indexedLabel,
	parseBenchmarkNonce,
	streamBlock,
	streamKey,
} from './nonce-stream.util';

const RFC_8439_ZERO_KEY_KEYSTREAM =
	'76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7';
const GEMM_A_STREAM_KEY =
	'51da66f9462e1688586ef9b53d9398eeeacfe4a7aaa95e5a8730c32ad6d987b2';
const GEMM_B_ZERO_STREAM_KEY =
	'32f920394224f081e1af3490fb2ca30e018ffa7474dc3714ba6b17118ee29260';
const GEMM_A_BLOCK_THREE_PREFIX =
	'1a42c74ef41be9a04764c95d85134d2efb86603be96c9f29b8d2b1be43b5ef67';
const MEBIBYTE = 1_048_576;
const PREFIX_BYTES = 32;
const CHACHA_BLOCK_BYTES = 64;

describe('nonce stream', () => {
	it('is RFC 8439 ChaCha20 with a zero counter', () => {
		assert.equal(
			streamBlock(Buffer.alloc(32), 0n, PREFIX_BYTES).toString('hex'),
			RFC_8439_ZERO_KEY_KEYSTREAM
		);
	});

	it('derives the published per-label keys', () => {
		assert.equal(
			streamKey(TEST_NONCE, BENCHMARK_LABEL.GEMM_A).toString('hex'),
			GEMM_A_STREAM_KEY
		);
		assert.equal(
			streamKey(TEST_NONCE, indexedLabel(BENCHMARK_LABEL.GEMM_B, 0)).toString(
				'hex'
			),
			GEMM_B_ZERO_STREAM_KEY
		);
	});

	it('regenerates any block independently and deterministically', () => {
		const key = streamKey(TEST_NONCE, BENCHMARK_LABEL.GEMM_A);
		const block = streamBlock(key, 3n, MEBIBYTE);
		assert.equal(
			block.subarray(0, PREFIX_BYTES).toString('hex'),
			GEMM_A_BLOCK_THREE_PREFIX
		);
		assert.deepEqual(streamBlock(key, 3n, MEBIBYTE), block);
		assert.deepEqual(
			streamBlock(key, 3n, CHACHA_BLOCK_BYTES),
			block.subarray(0, CHACHA_BLOCK_BYTES)
		);
		assert.notDeepEqual(streamBlock(key, 4n, MEBIBYTE), block);
		assert.notDeepEqual(
			streamBlock(
				streamKey(TEST_NONCE, BENCHMARK_LABEL.GEMM_B),
				3n,
				CHACHA_BLOCK_BYTES
			),
			block.subarray(0, CHACHA_BLOCK_BYTES)
		);
	});

	it('accepts only 32-byte lowercase hex nonces', () => {
		assert.deepEqual(
			parseBenchmarkNonce(TEST_NONCE.toString('hex')),
			TEST_NONCE
		);
		assert.equal(parseBenchmarkNonce('ab'), null);
		assert.equal(
			parseBenchmarkNonce(TEST_NONCE.toString('hex').toUpperCase()),
			null
		);
	});
});
