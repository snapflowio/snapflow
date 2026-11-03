/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create, type MessageInitShape } from '@bufbuild/protobuf';
import {
	type CpuMeasurement,
	CpuMeasurementSchema,
	type GpuMeasurementSchema,
	type MerkleSample,
	MerkleSampleSchema,
} from '@snapflow/machine-proto';
import {
	BENCHMARK_LABEL,
	BENCHMARK_PROTOCOL,
} from '../constants/benchmark-policy.constants';
import type { BenchmarkParameters } from '../types/benchmark.types';
import {
	cpuThreadSeed,
	hashChain,
	sampleIndices,
} from '../utils/benchmark-verification.util';
import {
	gemmKeys,
	gemmMatrix,
	gemmMatrixRow,
	gemmProductRow,
} from '../utils/gemm-proof.util';
import { merkleLeafHash, merkleNodeHash } from '../utils/merkle-proof.util';
import { indexedLabel } from '../utils/nonce-stream.util';

export const TEST_PARAMETERS: Readonly<BenchmarkParameters> = {
	cpuSegmentIterations: 4,
	cpuSampleCount: 6,
	gemmDimension: 8,
	gemmSampleCount: 3,
	minimumCapacityBasisPoints: 1,
	guestMemoryAllowanceBytes: 0,
	guestVramAllowanceBytes: 0,
	minimumCpuWorkMillis: 1_000,
	minimumServerObservedMillis: 1_000,
	minimumCpuScorePerVcpu: 0,
	maximumPageTouchP999Micros: 100,
	minimumSpeedtestBytes: 1_024,
};

export const TEST_NONCE_HEX =
	'6a09e667f3bcc908bb67ae8584caa73b3c6ef372fe94f82ba54ff53a5f1d36f1';

export const TEST_NONCE = Buffer.from(TEST_NONCE_HEX, 'hex');

function largestPowerOfTwoBelow(size: number): number {
	let split = 1;
	while (split * 2 < size) split *= 2;
	return split;
}

export function merkleTreeRoot(leaves: readonly Uint8Array[]): Buffer {
	if (leaves.length === 1) return merkleLeafHash(leaves[0]);
	const split = largestPowerOfTwoBelow(leaves.length);
	return merkleNodeHash(
		merkleTreeRoot(leaves.slice(0, split)),
		merkleTreeRoot(leaves.slice(split))
	);
}

export function merkleInclusionPath(
	index: number,
	leaves: readonly Uint8Array[]
): Buffer[] {
	if (leaves.length === 1) return [];
	const split = largestPowerOfTwoBelow(leaves.length);
	return index < split
		? [
				...merkleInclusionPath(index, leaves.slice(0, split)),
				merkleTreeRoot(leaves.slice(split)),
			]
		: [
				...merkleInclusionPath(index - split, leaves.slice(split)),
				merkleTreeRoot(leaves.slice(0, split)),
			];
}

export interface SampledTreeFixture {
	root: Buffer;
	samples: MerkleSample[];
}

export function sampledTree(
	label: string,
	leaves: readonly Uint8Array[],
	sampleCount: number
): SampledTreeFixture {
	const root = merkleTreeRoot(leaves);
	const samples = sampleIndices(
		TEST_NONCE,
		label,
		root,
		BigInt(leaves.length),
		sampleCount
	).map((index) =>
		create(MerkleSampleSchema, {
			index,
			leaf: leaves[Number(index)],
			path: merkleInclusionPath(Number(index), leaves),
		})
	);
	return { root, samples };
}

export function cpuMeasurement(
	threads: number,
	segmentsPerThread: number,
	workMillis: bigint
): CpuMeasurement {
	const leaves: Buffer[] = [];
	for (let thread = 0; thread < threads; thread += 1) {
		let start = cpuThreadSeed(TEST_NONCE, thread);
		for (let segment = 0; segment < segmentsPerThread; segment += 1) {
			const end = hashChain(start, TEST_PARAMETERS.cpuSegmentIterations);
			leaves.push(Buffer.concat([start, end]));
			start = end;
		}
	}
	const tree = sampledTree(
		BENCHMARK_LABEL.CPU,
		leaves,
		TEST_PARAMETERS.cpuSampleCount
	);
	return create(CpuMeasurementSchema, {
		threads,
		iterationsPerThread: BigInt(
			segmentsPerThread * TEST_PARAMETERS.cpuSegmentIterations
		),
		root: tree.root,
		samples: tree.samples,
		workMillis,
	});
}

export function gemmRowLeaf(row: ArrayLike<number>): Buffer {
	const leaf = Buffer.alloc(row.length * BENCHMARK_PROTOCOL.GEMM_ELEMENT_BYTES);
	for (let column = 0; column < row.length; column += 1) {
		leaf.writeFloatLE(
			row[column],
			column * BENCHMARK_PROTOCOL.GEMM_ELEMENT_BYTES
		);
	}
	return leaf;
}

export function gemmRows(gpuIndex: number): Buffer[] {
	const dimension = TEST_PARAMETERS.gemmDimension;
	const keys = gemmKeys(TEST_NONCE, gpuIndex);
	const right = gemmMatrix(keys.right, dimension);
	return Array.from(Array(dimension).keys(), (row) =>
		gemmRowLeaf(
			gemmProductRow(
				gemmMatrixRow(keys.left, BigInt(row), dimension),
				right,
				dimension
			)
		)
	);
}

export function gemmFields(
	gpuIndex: number,
	rows: readonly Uint8Array[]
): Pick<
	MessageInitShape<typeof GpuMeasurementSchema>,
	'gemmRoot' | 'gemmSamples'
> {
	const tree = sampledTree(
		indexedLabel(BENCHMARK_LABEL.GEMM, gpuIndex),
		rows,
		TEST_PARAMETERS.gemmSampleCount
	);
	return { gemmRoot: tree.root, gemmSamples: tree.samples };
}
