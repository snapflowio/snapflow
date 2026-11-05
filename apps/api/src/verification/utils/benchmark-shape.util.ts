/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ResourceShape } from '../../common/values/resource-shape.value';
import type { Machine } from '../../machine/entities/machine.entity';

export type BenchmarkShapeSource = Pick<
	Machine,
	| 'cpu'
	| 'memoryGiB'
	| 'diskGiB'
	| 'currentAllocatedDiskGiB'
	| 'passthroughGpuCount'
>;

export function benchmarkShape(machine: BenchmarkShapeSource): ResourceShape {
	return ResourceShape.wholeUnits({
		cpu: machine.cpu,
		memoryGiB: machine.memoryGiB,
		diskGiB: Math.max(0, machine.diskGiB - machine.currentAllocatedDiskGiB),
		gpu: machine.passthroughGpuCount,
	});
}
