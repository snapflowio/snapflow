/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createCipheriv, createHash } from 'node:crypto';
import {
	BENCHMARK_LABEL,
	BENCHMARK_PROTOCOL,
} from '../constants/benchmark-policy.constants';

const DIGEST_ALGORITHM = 'sha256';
const STREAM_CIPHER = 'chacha20';
const LABEL_SEPARATOR = Uint8Array.of(0);
const UINT32_BYTES = 4;
const UINT64_BYTES = 8;
const NONCE_HEX_PATTERN = /^[0-9a-f]{64}$/;

export function sha256(...parts: readonly Uint8Array[]): Buffer {
	const hash = createHash(DIGEST_ALGORITHM);
	for (const part of parts) hash.update(part);
	return hash.digest();
}

export function uint32BigEndian(value: number): Buffer {
	const buffer = Buffer.alloc(UINT32_BYTES);
	buffer.writeUInt32BE(value);
	return buffer;
}

export function uint64BigEndian(value: bigint): Buffer {
	const buffer = Buffer.alloc(UINT64_BYTES);
	buffer.writeBigUInt64BE(value);
	return buffer;
}

export function indexedLabel(label: string, index: number): string {
	return `${label}/${index}`;
}

export function labelledDigest(
	label: string,
	...parts: readonly Uint8Array[]
): Buffer {
	return sha256(
		Buffer.from(BENCHMARK_PROTOCOL.DOMAIN, 'utf8'),
		LABEL_SEPARATOR,
		Buffer.from(label, 'utf8'),
		LABEL_SEPARATOR,
		...parts
	);
}

export function parseBenchmarkNonce(nonceHex: string): Buffer | null {
	return NONCE_HEX_PATTERN.test(nonceHex) ? Buffer.from(nonceHex, 'hex') : null;
}

export function streamKey(nonce: Uint8Array, label: string): Buffer {
	return labelledDigest(indexedStreamLabel(label), nonce);
}

export function streamBlock(
	key: Uint8Array,
	blockIndex: bigint,
	length: number
): Buffer {
	const iv = Buffer.alloc(BENCHMARK_PROTOCOL.CHACHA20_IV_BYTES);
	iv.writeBigUInt64BE(
		blockIndex,
		BENCHMARK_PROTOCOL.CHACHA20_BLOCK_INDEX_OFFSET
	);
	const cipher = createCipheriv(STREAM_CIPHER, key, iv);
	return Buffer.concat([cipher.update(Buffer.alloc(length)), cipher.final()]);
}

function indexedStreamLabel(label: string): string {
	return `${BENCHMARK_LABEL.STREAM}/${label}`;
}
