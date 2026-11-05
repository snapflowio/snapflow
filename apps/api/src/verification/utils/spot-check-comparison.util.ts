/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import { BasisPoints } from '../../common/values/basis-points.value';
import {
	SPOT_CHECK_FAILURE,
	SPOT_CHECK_TOLERANCE_SUBJECT,
	type SpotCheckFailure,
} from '../constants/spot-check.constants';
import type { MeasuredCompute } from '../types/benchmark.types';

const UNSCALED_SHARE = 1;

export interface SpotCheckBaseline {
	vcpu: number;
	cpuScorePerVcpu: number;
	memoryBandwidthMibps: number;
	diskRandomReadIops: number;
	diskSequentialMibps: number;
	gpuTflops: number;
}

interface SpotCheckMetric {
	measured: number;
	baseline: number;
	measuredShare: number;
	baselineShare: number;
	failure: SpotCheckFailure;
}

function meetsScaledBaseline(
	metric: SpotCheckMetric,
	tolerance: BasisPoints
): boolean {
	return (
		metric.measured * metric.baselineShare * BASIS_POINTS_SCALE >=
		metric.baseline * metric.measuredShare * tolerance.complement().toNumber()
	);
}

function unscaled(
	measured: number,
	baseline: number,
	failure: SpotCheckFailure
): SpotCheckMetric {
	return {
		measured,
		baseline,
		measuredShare: UNSCALED_SHARE,
		baselineShare: UNSCALED_SHARE,
		failure,
	};
}

// Memory bandwidth scales with the sampled vCPU share. Disk figures do not:
// sandbox disks carry no rate limiter, so any share reaches the same device.
export function compareSpotCheck(
	baseline: SpotCheckBaseline,
	measured: MeasuredCompute,
	toleranceBasisPoints: number
): SpotCheckFailure[] {
	const tolerance = BasisPoints.of(
		toleranceBasisPoints,
		SPOT_CHECK_TOLERANCE_SUBJECT
	);
	const metrics: SpotCheckMetric[] = [
		unscaled(
			measured.cpuScorePerVcpu,
			baseline.cpuScorePerVcpu,
			SPOT_CHECK_FAILURE.CPU_SCORE_REGRESSED
		),
		{
			measured: measured.memoryBandwidthMibps,
			baseline: baseline.memoryBandwidthMibps,
			measuredShare: measured.vcpu,
			baselineShare: baseline.vcpu,
			failure: SPOT_CHECK_FAILURE.MEMORY_BANDWIDTH_REGRESSED,
		},
		unscaled(
			measured.disk.randomReadIops,
			baseline.diskRandomReadIops,
			SPOT_CHECK_FAILURE.DISK_IOPS_REGRESSED
		),
		unscaled(
			measured.disk.sequentialReadMibps,
			baseline.diskSequentialMibps,
			SPOT_CHECK_FAILURE.DISK_THROUGHPUT_REGRESSED
		),
		...(measured.gpu
			? [
					unscaled(
						measured.gpu.gpuTflops,
						baseline.gpuTflops,
						SPOT_CHECK_FAILURE.GPU_TFLOPS_REGRESSED
					),
				]
			: []),
	];
	return metrics
		.filter((metric) => !meetsScaledBaseline(metric, tolerance))
		.map(({ failure }) => failure);
}
