/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { GpuType } from '../../machine/enums/gpu-type.enum';

export interface GpuModel {
	gpuType: GpuType;
	memoryGib: number;
	minimumTflops: number;
	maximumTflops: number;
	gemmAbsoluteTolerance: number;
}

const H100_GEMM_ABSOLUTE_TOLERANCE = 0.5;
const RTX_PRO_6000_GEMM_ABSOLUTE_TOLERANCE = 0.5;

export const GPU_MODELS: Readonly<Record<string, GpuModel>> = {
	'0x2330': {
		gpuType: GpuType.H100,
		memoryGib: 80,
		minimumTflops: 400,
		maximumTflops: 1_000,
		gemmAbsoluteTolerance: H100_GEMM_ABSOLUTE_TOLERANCE,
	},
	'0x2331': {
		gpuType: GpuType.H100,
		memoryGib: 80,
		minimumTflops: 250,
		maximumTflops: 800,
		gemmAbsoluteTolerance: H100_GEMM_ABSOLUTE_TOLERANCE,
	},
	'0x2321': {
		gpuType: GpuType.H100,
		memoryGib: 94,
		minimumTflops: 300,
		maximumTflops: 900,
		gemmAbsoluteTolerance: H100_GEMM_ABSOLUTE_TOLERANCE,
	},
	'0x2bb1': {
		gpuType: GpuType.RTX_PRO_6000,
		memoryGib: 96,
		minimumTflops: 100,
		maximumTflops: 600,
		gemmAbsoluteTolerance: RTX_PRO_6000_GEMM_ABSOLUTE_TOLERANCE,
	},
	'0x2bb4': {
		gpuType: GpuType.RTX_PRO_6000,
		memoryGib: 96,
		minimumTflops: 80,
		maximumTflops: 500,
		gemmAbsoluteTolerance: RTX_PRO_6000_GEMM_ABSOLUTE_TOLERANCE,
	},
	'0x2bb5': {
		gpuType: GpuType.RTX_PRO_6000,
		memoryGib: 96,
		minimumTflops: 100,
		maximumTflops: 600,
		gemmAbsoluteTolerance: RTX_PRO_6000_GEMM_ABSOLUTE_TOLERANCE,
	},
};
