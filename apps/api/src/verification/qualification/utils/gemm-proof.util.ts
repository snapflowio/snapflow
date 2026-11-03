/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { GpuMeasurement } from '@snapflow/machine-proto';
import {
	BENCHMARK_LABEL,
	BENCHMARK_PROTOCOL,
} from '../constants/benchmark-policy.constants';
import type { BenchmarkParameters } from '../types/benchmark.types';
import { verifySampledTree } from './benchmark-verification.util';
import { indexedLabel, streamBlock, streamKey } from './nonce-stream.util';

export function gemmMatrixRow(
	key: Uint8Array,
	row: bigint,
	dimension: number
): Int8Array {
	const bytes = streamBlock(key, row, dimension);
	const values = new Int8Array(dimension);
	for (let column = 0; column < dimension; column += 1) {
		values[column] =
			(bytes[column] & BENCHMARK_PROTOCOL.GEMM_ELEMENT_MASK) -
			BENCHMARK_PROTOCOL.GEMM_ELEMENT_OFFSET;
	}
	return values;
}

export function gemmMatrix(key: Uint8Array, dimension: number): Int8Array {
	const matrix = new Int8Array(dimension * dimension);
	for (let row = 0; row < dimension; row += 1) {
		matrix.set(gemmMatrixRow(key, BigInt(row), dimension), row * dimension);
	}
	return matrix;
}

export function gemmProductRow(
	left: Int8Array,
	right: Int8Array,
	dimension: number
): Int32Array {
	const product = new Int32Array(dimension);
	for (let inner = 0; inner < dimension; inner += 1) {
		const factor = left[inner];
		if (factor === 0) continue;
		const offset = inner * dimension;
		for (let column = 0; column < dimension; column += 1) {
			product[column] += factor * right[offset + column];
		}
	}
	return product;
}

export function gemmKeys(
	nonce: Uint8Array,
	gpuIndex: number
): { left: Buffer; right: Buffer } {
	return {
		left: streamKey(nonce, indexedLabel(BENCHMARK_LABEL.GEMM_A, gpuIndex)),
		right: streamKey(nonce, indexedLabel(BENCHMARK_LABEL.GEMM_B, gpuIndex)),
	};
}

function rowWithinTolerance(
	leaf: Uint8Array,
	expected: Int32Array,
	tolerance: number
): boolean {
	if (leaf.length !== expected.length * BENCHMARK_PROTOCOL.GEMM_ELEMENT_BYTES) {
		return false;
	}
	const view = Buffer.from(leaf.buffer, leaf.byteOffset, leaf.byteLength);
	for (let column = 0; column < expected.length; column += 1) {
		const actual = view.readFloatLE(
			column * BENCHMARK_PROTOCOL.GEMM_ELEMENT_BYTES
		);
		if (
			!Number.isFinite(actual) ||
			Math.abs(actual - expected[column]) > tolerance
		) {
			return false;
		}
	}
	return true;
}

export function verifyGemmProof(
	nonce: Uint8Array,
	gpuIndex: number,
	gpu: GpuMeasurement,
	tolerance: number,
	parameters: BenchmarkParameters
): boolean {
	const dimension = parameters.gemmDimension;
	if (gpu.gemmSamples.length !== parameters.gemmSampleCount) return false;
	const keys = gemmKeys(nonce, gpuIndex);
	const right = gemmMatrix(keys.right, dimension);
	return verifySampledTree({
		nonce,
		label: indexedLabel(BENCHMARK_LABEL.GEMM, gpuIndex),
		root: gpu.gemmRoot,
		leafCount: BigInt(dimension),
		samples: gpu.gemmSamples,
		sampleCount: parameters.gemmSampleCount,
		leafValid: (leafIndex, leaf) =>
			rowWithinTolerance(
				leaf,
				gemmProductRow(
					gemmMatrixRow(keys.left, leafIndex, dimension),
					right,
					dimension
				),
				tolerance
			),
	});
}
