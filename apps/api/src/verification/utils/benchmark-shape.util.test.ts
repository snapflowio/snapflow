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
	type BenchmarkShapeSource,
	benchmarkShape,
} from './benchmark-shape.util';

const machine: BenchmarkShapeSource = {
	cpu: 8,
	memoryGiB: 31.6,
	diskGiB: 24,
	currentAllocatedDiskGiB: 0,
	passthroughGpuCount: 0,
};

describe('benchmarkShape', () => {
	it('issues the whole admittable disk capacity of an idle machine', () => {
		assert.deepEqual(benchmarkShape(machine).toColumns(), {
			cpu: 8,
			memoryGib: 31,
			diskGib: 24,
			gpu: 0,
		});
	});

	it('leaves out disk the machine already allocated', () => {
		assert.equal(
			benchmarkShape({ ...machine, currentAllocatedDiskGiB: 6 }).diskGiB,
			18
		);
	});

	it('issues no disk when allocation covers the capacity', () => {
		assert.equal(
			benchmarkShape({ ...machine, currentAllocatedDiskGiB: 30 }).diskGiB,
			0
		);
	});

	it('challenges every GPU the machine can pass through before a benchmark proved one', () => {
		assert.equal(benchmarkShape({ ...machine, passthroughGpuCount: 2 }).gpu, 2);
	});

	it('challenges no GPU when the machine can pass none through', () => {
		assert.equal(benchmarkShape(machine).gpu, 0);
	});
});
