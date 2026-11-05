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
import { create } from '@bufbuild/protobuf';
import { GpuMeasurementSchema } from '@snapflow/machine-proto';
import { BENCHMARK_PROTOCOL } from '../constants/benchmark-policy.constants';
import {
	gemmFields,
	gemmRows,
	TEST_NONCE,
	TEST_PARAMETERS,
} from '../testing/benchmark.fixtures';
import { gemmKeys, gemmMatrixRow, verifyGemmProof } from './gemm-proof.util';

const TOLERANCE = 0.5;
const WITHIN_TOLERANCE = 0.25;
const BEYOND_TOLERANCE = 1;
const PUBLISHED_LEFT_ROW_PREFIX = [-4, 0, 2, 3, -4, -4, -4, -4];
const PRODUCTION_DIMENSION = 4_096;

function perturbedRows(delta: number): Buffer[] {
	return gemmRows(0).map((row) => {
		const copy = Buffer.from(row);
		for (
			let offset = 0;
			offset < copy.length;
			offset += BENCHMARK_PROTOCOL.GEMM_ELEMENT_BYTES
		) {
			copy.writeFloatLE(copy.readFloatLE(offset) + delta, offset);
		}
		return copy;
	});
}

function measurement(rows: readonly Uint8Array[], gpuIndex = 0) {
	return create(GpuMeasurementSchema, gemmFields(gpuIndex, rows));
}

describe('verifyGemmProof', () => {
	it('maps the nonce stream to the published matrix elements', () => {
		assert.deepEqual(
			Array.from(
				gemmMatrixRow(
					gemmKeys(TEST_NONCE, 0).left,
					0n,
					PRODUCTION_DIMENSION
				).subarray(0, PUBLISHED_LEFT_ROW_PREFIX.length)
			),
			PUBLISHED_LEFT_ROW_PREFIX
		);
	});

	it('accepts sampled rows recomputed as A_i times B', () => {
		assert.equal(
			verifyGemmProof(
				TEST_NONCE,
				0,
				measurement(gemmRows(0)),
				TOLERANCE,
				TEST_PARAMETERS
			),
			true
		);
	});

	it('accepts float error inside the model tolerance', () => {
		assert.equal(
			verifyGemmProof(
				TEST_NONCE,
				0,
				measurement(perturbedRows(WITHIN_TOLERANCE)),
				TOLERANCE,
				TEST_PARAMETERS
			),
			true
		);
	});

	it('rejects rows outside the tolerance', () => {
		assert.equal(
			verifyGemmProof(
				TEST_NONCE,
				0,
				measurement(perturbedRows(BEYOND_TOLERANCE)),
				TOLERANCE,
				TEST_PARAMETERS
			),
			false
		);
	});

	it('binds the product to the GPU index', () => {
		assert.equal(
			verifyGemmProof(
				TEST_NONCE,
				1,
				measurement(gemmRows(0)),
				TOLERANCE,
				TEST_PARAMETERS
			),
			false
		);
	});
});
