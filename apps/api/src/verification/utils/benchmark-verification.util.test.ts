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
import { MerkleSampleSchema } from '@snapflow/machine-proto';
import { BENCHMARK_LABEL } from '../constants/benchmark-policy.constants';
import {
	cpuMeasurement,
	TEST_NONCE,
	TEST_PARAMETERS,
} from '../testing/benchmark.fixtures';
import {
	cpuThreadSeed,
	hashChain,
	sampleIndices,
	verifyCpuProof,
} from './benchmark-verification.util';

const PUBLISHED_SAMPLE = [36n, 345n, 126n, 792n, 826n];
const CPU_SEED_ZERO =
	'67515574ad4da670b7e229c40b3eb872380ba8c5d97aecb660df27e0cbdbe1ef';
const CPU_SEED_ONE_SEGMENT =
	'1c54c3f7d266a1f7f3c1d250f175c52030a2c186b97cb034f90fabca35a54d91';
const PRODUCTION_SEGMENT_ITERATIONS = 65_536;
const WORK_MILLIS = 2_000n;

describe('Fiat-Shamir sampling', () => {
	const root = Buffer.alloc(32);

	it('is deterministic and matches the published vector', () => {
		const first = sampleIndices(
			TEST_NONCE,
			BENCHMARK_LABEL.CPU,
			root,
			1_000n,
			5
		);
		assert.deepEqual(first, PUBLISHED_SAMPLE);
		assert.deepEqual(
			sampleIndices(TEST_NONCE, BENCHMARK_LABEL.CPU, root, 1_000n, 5),
			first
		);
	});

	it('changes with the root, label, nonce and leaf count', () => {
		const base = sampleIndices(
			TEST_NONCE,
			BENCHMARK_LABEL.CPU,
			root,
			1_000n,
			8
		);
		assert.notDeepEqual(
			sampleIndices(
				TEST_NONCE,
				BENCHMARK_LABEL.CPU,
				Buffer.alloc(32, 1),
				1_000n,
				8
			),
			base
		);
		assert.notDeepEqual(
			sampleIndices(TEST_NONCE, BENCHMARK_LABEL.GEMM, root, 1_000n, 8),
			base
		);
		assert.notDeepEqual(
			sampleIndices(Buffer.alloc(32), BENCHMARK_LABEL.CPU, root, 1_000n, 8),
			base
		);
		assert.notDeepEqual(
			sampleIndices(TEST_NONCE, BENCHMARK_LABEL.CPU, root, 1_001n, 8),
			base
		);
	});

	it('stays inside the tree', () => {
		for (const index of sampleIndices(
			TEST_NONCE,
			BENCHMARK_LABEL.CPU,
			root,
			3n,
			64
		)) {
			assert.ok(index >= 0n && index < 3n);
		}
	});
});

describe('verifyCpuProof', () => {
	it('derives the published thread seeds and chains', () => {
		assert.equal(cpuThreadSeed(TEST_NONCE, 0).toString('hex'), CPU_SEED_ZERO);
		assert.equal(
			hashChain(
				cpuThreadSeed(TEST_NONCE, 1),
				PRODUCTION_SEGMENT_ITERATIONS
			).toString('hex'),
			CPU_SEED_ONE_SEGMENT
		);
	});

	it('accepts honest hash-chain segments', () => {
		assert.equal(
			verifyCpuProof(
				TEST_NONCE,
				cpuMeasurement(3, 5, WORK_MILLIS),
				TEST_PARAMETERS
			),
			true
		);
	});

	it('rejects a claimed iteration count the tree does not commit to', () => {
		const cpu = cpuMeasurement(3, 5, WORK_MILLIS);
		cpu.iterationsPerThread += BigInt(TEST_PARAMETERS.cpuSegmentIterations);
		assert.equal(verifyCpuProof(TEST_NONCE, cpu, TEST_PARAMETERS), false);
	});

	it('rejects a forged segment end', () => {
		const cpu = cpuMeasurement(3, 5, WORK_MILLIS);
		const [sample] = cpu.samples;
		const leaf = Buffer.from(sample.leaf);
		leaf[leaf.length - 1] ^= 1;
		cpu.samples[0] = create(MerkleSampleSchema, { ...sample, leaf });
		assert.equal(verifyCpuProof(TEST_NONCE, cpu, TEST_PARAMETERS), false);
	});

	it('rejects a different nonce', () => {
		assert.equal(
			verifyCpuProof(
				Buffer.alloc(32),
				cpuMeasurement(2, 4, WORK_MILLIS),
				TEST_PARAMETERS
			),
			false
		);
	});
});
