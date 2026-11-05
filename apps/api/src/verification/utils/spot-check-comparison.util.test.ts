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
import { DiskMeasurementSchema } from '@snapflow/machine-proto';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { SPOT_CHECK_FAILURE } from '../constants/spot-check.constants';
import type { MeasuredCompute } from '../types/benchmark.types';
import {
	compareSpotCheck,
	type SpotCheckBaseline,
} from './spot-check-comparison.util';

const TOLERANCE_BASIS_POINTS = 2_000;

const baseline: SpotCheckBaseline = {
	vcpu: 32,
	cpuScorePerVcpu: 5_000,
	memoryBandwidthMibps: 64_000,
	diskRandomReadIops: 500_000,
	diskSequentialMibps: 6_000,
	gpuTflops: 600,
};

const quarterShape: MeasuredCompute = {
	vcpu: 8,
	cpuSingleThreadScore: 1_000,
	cpuScorePerVcpu: 4_000,
	memoryBandwidthMibps: 12_800,
	memoryLatencyNs: 90,
	disk: create(DiskMeasurementSchema, {
		randomReadIops: 400_000,
		sequentialReadMibps: 4_800,
	}),
	gpu: {
		gpuType: GpuType.H100,
		gpuCount: 1,
		gpuMemoryGib: 80,
		gpuTflops: 480,
	},
};

describe('compareSpotCheck', () => {
	it('passes delivered performance at the tolerance boundary', () => {
		assert.deepEqual(
			compareSpotCheck(baseline, quarterShape, TOLERANCE_BASIS_POINTS),
			[]
		);
	});

	it('scales memory bandwidth by the vCPU share', () => {
		assert.deepEqual(
			compareSpotCheck(
				baseline,
				{ ...quarterShape, memoryBandwidthMibps: 12_799 },
				TOLERANCE_BASIS_POINTS
			),
			[SPOT_CHECK_FAILURE.MEMORY_BANDWIDTH_REGRESSED]
		);
	});

	it('flags CPU and per-GPU regressions', () => {
		assert.deepEqual(
			compareSpotCheck(
				baseline,
				{
					...quarterShape,
					cpuScorePerVcpu: 3_999,
					gpu: quarterShape.gpu && { ...quarterShape.gpu, gpuTflops: 479 },
				},
				TOLERANCE_BASIS_POINTS
			),
			[
				SPOT_CHECK_FAILURE.CPU_SCORE_REGRESSED,
				SPOT_CHECK_FAILURE.GPU_TFLOPS_REGRESSED,
			]
		);
	});

	it('ignores GPU throughput for CPU-only sandboxes', () => {
		assert.deepEqual(
			compareSpotCheck(
				baseline,
				{ ...quarterShape, gpu: null },
				TOLERANCE_BASIS_POINTS
			),
			[]
		);
	});

	it('compares disk throughput against the full baseline at any shape', () => {
		assert.deepEqual(
			compareSpotCheck(
				baseline,
				{
					...quarterShape,
					disk: create(DiskMeasurementSchema, {
						randomReadIops: 399_999,
						sequentialReadMibps: 4_799,
					}),
				},
				TOLERANCE_BASIS_POINTS
			),
			[
				SPOT_CHECK_FAILURE.DISK_IOPS_REGRESSED,
				SPOT_CHECK_FAILURE.DISK_THROUGHPUT_REGRESSED,
			]
		);
	});
});
