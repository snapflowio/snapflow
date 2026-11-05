/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { CpuMeasurement, MerkleSample } from '@snapflow/machine-proto';
import {
	BENCHMARK_LABEL,
	BENCHMARK_PROTOCOL,
} from '../constants/benchmark-policy.constants';
import type { BenchmarkParameters } from '../types/benchmark.types';
import { verifyMerkleInclusion } from './merkle-proof.util';
import {
	labelledDigest,
	sha256,
	uint32BigEndian,
	uint64BigEndian,
} from './nonce-stream.util';

const CPU_LEAF_BYTES = 2 * BENCHMARK_PROTOCOL.DIGEST_BYTES;

export interface SampledTree {
	nonce: Uint8Array;
	label: string;
	root: Uint8Array;
	leafCount: bigint;
	samples: readonly MerkleSample[];
	sampleCount: number;
	leafValid: (leafIndex: bigint, leaf: Uint8Array) => boolean;
}

export function sampleIndices(
	nonce: Uint8Array,
	label: string,
	root: Uint8Array,
	leafCount: bigint,
	count: number
): bigint[] {
	const seed = labelledDigest(
		`${BENCHMARK_LABEL.SAMPLE}/${label}`,
		nonce,
		root,
		uint64BigEndian(leafCount)
	);
	const indices: bigint[] = [];
	for (let sample = 0; sample < count; sample += 1) {
		indices.push(
			sha256(seed, uint32BigEndian(sample)).readBigUInt64BE() % leafCount
		);
	}
	return indices;
}

export function verifySampledTree(tree: SampledTree): boolean {
	if (tree.leafCount <= 0n || tree.samples.length !== tree.sampleCount) {
		return false;
	}
	const expected = sampleIndices(
		tree.nonce,
		tree.label,
		tree.root,
		tree.leafCount,
		tree.sampleCount
	);
	return tree.samples.every(
		(sample, position) =>
			sample.index === expected[position] &&
			tree.leafValid(sample.index, sample.leaf) &&
			verifyMerkleInclusion({
				leafIndex: sample.index,
				treeSize: tree.leafCount,
				leafData: sample.leaf,
				path: sample.path,
				root: tree.root,
			})
	);
}

export function cpuThreadSeed(nonce: Uint8Array, thread: number): Buffer {
	return labelledDigest(
		BENCHMARK_LABEL.CPU_SEED,
		nonce,
		uint32BigEndian(thread)
	);
}

export function hashChain(start: Uint8Array, iterations: number): Buffer {
	let current: Buffer = Buffer.from(start);
	for (let iteration = 0; iteration < iterations; iteration += 1) {
		current = sha256(current);
	}
	return current;
}

export function cpuSegmentsPerThread(
	cpu: CpuMeasurement,
	parameters: BenchmarkParameters
): bigint | null {
	const segment = BigInt(parameters.cpuSegmentIterations);
	if (
		cpu.iterationsPerThread <= 0n ||
		cpu.iterationsPerThread % segment !== 0n
	) {
		return null;
	}
	return cpu.iterationsPerThread / segment;
}

export function verifyCpuProof(
	nonce: Uint8Array,
	cpu: CpuMeasurement,
	parameters: BenchmarkParameters
): boolean {
	const segments = cpuSegmentsPerThread(cpu, parameters);
	if (segments === null || cpu.threads <= 0) return false;
	return verifySampledTree({
		nonce,
		label: BENCHMARK_LABEL.CPU,
		root: cpu.root,
		leafCount: segments * BigInt(cpu.threads),
		samples: cpu.samples,
		sampleCount: parameters.cpuSampleCount,
		leafValid: (leafIndex, leaf) => {
			if (leaf.length !== CPU_LEAF_BYTES) return false;
			const start = leaf.subarray(0, BENCHMARK_PROTOCOL.DIGEST_BYTES);
			const end = leaf.subarray(BENCHMARK_PROTOCOL.DIGEST_BYTES);
			const segment = leafIndex % segments;
			const thread = Number(leafIndex / segments);
			if (segment === 0n && !cpuThreadSeed(nonce, thread).equals(start)) {
				return false;
			}
			return hashChain(start, parameters.cpuSegmentIterations).equals(end);
		},
	});
}
