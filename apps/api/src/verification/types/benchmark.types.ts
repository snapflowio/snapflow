/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { DiskMeasurement } from '@snapflow/machine-proto';
import type { GpuType } from '../../machine/enums/gpu-type.enum';

export interface BenchmarkParameters {
	cpuSegmentIterations: number;
	cpuSampleCount: number;
	gemmDimension: number;
	gemmSampleCount: number;
	minimumCapacityBasisPoints: number;
	guestMemoryAllowanceBytes: number;
	guestVramAllowanceBytes: number;
	minimumCpuWorkMillis: number;
	minimumServerObservedMillis: number;
	minimumCpuScorePerVcpu: number;
	maximumPageTouchP999Micros: number;
	minimumSpeedtestBytes: number;
}

export interface BenchmarkShapeValues {
	cpu: number;
	memoryGib: number;
	diskGib: number;
	gpu: number;
}

export interface MeasuredGpu {
	gpuType: GpuType;
	gpuCount: number;
	gpuMemoryGib: number;
	gpuTflops: number;
}

export interface MeasuredCompute {
	vcpu: number;
	cpuSingleThreadScore: number;
	cpuScorePerVcpu: number;
	memoryBandwidthMibps: number;
	memoryLatencyNs: number;
	disk: DiskMeasurement;
	gpu: MeasuredGpu | null;
}

export interface EdgeIdentityKey {
	keyId: string;
	publicKeyPem: string;
}
