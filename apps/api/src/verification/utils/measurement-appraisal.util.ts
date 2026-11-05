/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	BenchmarkMeasurements,
	CpuMeasurement,
	GpuMeasurement,
	MemoryMeasurement,
} from '@snapflow/machine-proto';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import {
	BENCHMARK_FAILURE,
	BENCHMARK_POLICY,
	type BenchmarkFailure,
} from '../constants/benchmark-policy.constants';
import { GPU_MODELS, type GpuModel } from '../constants/gpu-model.constants';
import type {
	BenchmarkParameters,
	BenchmarkShapeValues,
	MeasuredCompute,
	MeasuredGpu,
} from '../types/benchmark.types';
import { verifyCpuProof } from './benchmark-verification.util';
import { verifyGemmProof } from './gemm-proof.util';
import { hexDigest } from './inventory-digest.util';

export interface ComputeAppraisal {
	failures: BenchmarkFailure[];
	compute: MeasuredCompute | null;
}

interface Capacity {
	gib: number;
	guestAllowanceBytes: number;
}

function capacityMet(
	bytes: bigint,
	capacity: Capacity,
	parameters: BenchmarkParameters
): boolean {
	return (
		bytes * BigInt(BASIS_POINTS_SCALE) >=
		(BigInt(capacity.gib) * BigInt(BENCHMARK_POLICY.BYTES_PER_GIB) -
			BigInt(capacity.guestAllowanceBytes)) *
			BigInt(parameters.minimumCapacityBasisPoints)
	);
}

function cpuScorePerVcpu(cpu: CpuMeasurement | undefined): number {
	return cpu && cpu.threads > 0
		? Math.floor(cpu.multiThreadScore / cpu.threads)
		: 0;
}

function appraiseCpu(
	nonce: Uint8Array,
	shape: BenchmarkShapeValues,
	cpu: CpuMeasurement | undefined,
	parameters: BenchmarkParameters
): BenchmarkFailure[] {
	const failures: BenchmarkFailure[] = [];
	if (!cpu || !verifyCpuProof(nonce, cpu, parameters)) {
		failures.push(BENCHMARK_FAILURE.CPU_PROOF_INVALID);
	}
	if (cpu && cpu.threads !== shape.cpu) {
		failures.push(BENCHMARK_FAILURE.CPU_THREADS_MISMATCH);
	}
	if (cpu && cpu.workMillis < BigInt(parameters.minimumCpuWorkMillis)) {
		failures.push(BENCHMARK_FAILURE.WORK_TOO_SHORT);
	}
	if (cpuScorePerVcpu(cpu) < parameters.minimumCpuScorePerVcpu) {
		failures.push(BENCHMARK_FAILURE.CPU_SCORE_LOW);
	}
	return failures;
}

function appraiseMemory(
	shape: BenchmarkShapeValues,
	memory: MemoryMeasurement | undefined,
	parameters: BenchmarkParameters
): BenchmarkFailure[] {
	const failures: BenchmarkFailure[] = [];
	const capacity = {
		gib: shape.memoryGib,
		guestAllowanceBytes: parameters.guestMemoryAllowanceBytes,
	};
	if (!capacityMet(memory?.bytes ?? 0n, capacity, parameters)) {
		failures.push(BENCHMARK_FAILURE.MEMORY_CAPACITY_LOW);
	}
	if (
		memory &&
		memory.pageTouchP999Micros > parameters.maximumPageTouchP999Micros
	) {
		failures.push(BENCHMARK_FAILURE.MEMORY_OVERCOMMITTED);
	}
	return failures;
}

function pcieDegraded(gpu: GpuMeasurement): boolean {
	return (
		gpu.pcieCurrentSpeedMts < gpu.pcieMaxSpeedMts ||
		gpu.pcieCurrentWidth < gpu.pcieMaxWidth
	);
}

function appraiseGpu(
	nonce: Uint8Array,
	index: number,
	gpu: GpuMeasurement,
	model: GpuModel,
	parameters: BenchmarkParameters,
	gpuFingerprints: ReadonlySet<string> | null
): BenchmarkFailure[] {
	const failures: BenchmarkFailure[] = [];
	if (gpuFingerprints && !gpuFingerprints.has(hexDigest(gpu.uuid))) {
		failures.push(BENCHMARK_FAILURE.GPU_NOT_IN_INVENTORY);
	}
	const capacity = {
		gib: model.memoryGib,
		guestAllowanceBytes: parameters.guestVramAllowanceBytes,
	};
	if (!capacityMet(gpu.vramBytes, capacity, parameters)) {
		failures.push(BENCHMARK_FAILURE.VRAM_CAPACITY_LOW);
	}
	if (
		!verifyGemmProof(nonce, index, gpu, model.gemmAbsoluteTolerance, parameters)
	) {
		failures.push(BENCHMARK_FAILURE.GEMM_PROOF_INVALID);
	}
	if (gpu.tflops < model.minimumTflops || gpu.tflops > model.maximumTflops) {
		failures.push(BENCHMARK_FAILURE.GPU_TFLOPS_OUT_OF_BAND);
	}
	if (pcieDegraded(gpu)) failures.push(BENCHMARK_FAILURE.GPU_PCIE_DEGRADED);
	if (gpu.uncorrectedEccErrors > 0n || gpu.retiredPagesPending) {
		failures.push(BENCHMARK_FAILURE.GPU_MEMORY_ERRORS);
	}
	return failures;
}

function appraiseGpus(
	nonce: Uint8Array,
	gpus: readonly GpuMeasurement[],
	expectedCount: number,
	parameters: BenchmarkParameters,
	gpuFingerprints: ReadonlySet<string> | null
): { failures: BenchmarkFailure[]; gpu: MeasuredGpu | null } {
	if (gpus.length !== expectedCount) {
		return { failures: [BENCHMARK_FAILURE.GPU_COUNT_MISMATCH], gpu: null };
	}
	if (gpus.length === 0) return { failures: [], gpu: null };
	const models = gpus.map((gpu) => GPU_MODELS[gpu.pciDeviceId.toLowerCase()]);
	if (models.some((model) => !model)) {
		return { failures: [BENCHMARK_FAILURE.GPU_UNRECOGNIZED], gpu: null };
	}
	const [first] = models;
	if (models.some((model) => model.gpuType !== first.gpuType)) {
		return { failures: [BENCHMARK_FAILURE.GPU_MIXED_MODELS], gpu: null };
	}
	const failures = gpus.flatMap((gpu, index) =>
		appraiseGpu(nonce, index, gpu, models[index], parameters, gpuFingerprints)
	);
	return {
		failures,
		gpu: {
			gpuType: first.gpuType,
			gpuCount: gpus.length,
			gpuMemoryGib: Math.min(...models.map((model) => model.memoryGib)),
			gpuTflops: Math.min(...gpus.map((gpu) => gpu.tflops)),
		},
	};
}

export function appraiseCompute(
	nonce: Uint8Array,
	shape: BenchmarkShapeValues,
	measurements: BenchmarkMeasurements,
	parameters: BenchmarkParameters,
	gpuFingerprints: ReadonlySet<string> | null
): ComputeAppraisal {
	const { cpu, memory, disk } = measurements;
	const gpus = appraiseGpus(
		nonce,
		measurements.gpus,
		shape.gpu,
		parameters,
		gpuFingerprints
	);
	const failures = [
		...appraiseCpu(nonce, shape, cpu, parameters),
		...appraiseMemory(shape, memory, parameters),
		...(disk ? [] : [BENCHMARK_FAILURE.DISK_MISSING]),
		...gpus.failures,
	];
	if (failures.length > 0 || !cpu || !memory || !disk) {
		return { failures, compute: null };
	}
	return {
		failures,
		compute: {
			vcpu: cpu.threads,
			cpuSingleThreadScore: cpu.singleThreadScore,
			cpuScorePerVcpu: cpuScorePerVcpu(cpu),
			memoryBandwidthMibps: memory.bandwidthMibps,
			memoryLatencyNs: memory.latencyNs,
			disk,
			gpu: gpus.gpu,
		},
	};
}
