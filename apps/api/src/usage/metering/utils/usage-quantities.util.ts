/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { fixed, parseFixed } from '../../../common/utils/fixed-point.util';
import type { UsageQuantities } from '../../../marketplace/machine/types/pricing.types';
import { USAGE_RESOURCE_SCALE } from '../constants/usage-accounting.constants';
import { UsageMode } from '../constants/usage-lifecycle.constants';

export interface AllocationUnits {
	cpu: bigint;
	memoryGiB: bigint;
	diskGiB: bigint;
	gpu: bigint;
}

export type AllocationColumns = Record<keyof AllocationUnits, string>;

export type UsageQuantityColumns = Record<keyof UsageQuantities, string>;

export function allocationUnits(value: number, name: string): bigint {
	if (!Number.isFinite(value) || value < 0) {
		throw new Error(`${name} allocation must be a nonnegative finite number`);
	}
	return parseFixed(
		value.toFixed(USAGE_RESOURCE_SCALE),
		USAGE_RESOURCE_SCALE,
		name
	);
}

export function parseAllocation(columns: AllocationColumns): AllocationUnits {
	return {
		cpu: parseFixed(columns.cpu, USAGE_RESOURCE_SCALE, 'CPU'),
		memoryGiB: parseFixed(columns.memoryGiB, USAGE_RESOURCE_SCALE, 'memory'),
		diskGiB: parseFixed(columns.diskGiB, USAGE_RESOURCE_SCALE, 'disk'),
		gpu: parseFixed(columns.gpu, USAGE_RESOURCE_SCALE, 'GPU'),
	};
}

export function allocationColumns(units: AllocationUnits): AllocationColumns {
	return {
		cpu: fixed(units.cpu, USAGE_RESOURCE_SCALE),
		memoryGiB: fixed(units.memoryGiB, USAGE_RESOURCE_SCALE),
		diskGiB: fixed(units.diskGiB, USAGE_RESOURCE_SCALE),
		gpu: fixed(units.gpu, USAGE_RESOURCE_SCALE),
	};
}

export function quantitiesFor(
	units: AllocationUnits,
	runningMillis: bigint,
	stoppedMillis: bigint
): UsageQuantities {
	if (runningMillis < 0n || stoppedMillis < 0n) {
		throw new Error('Usage durations must be nonnegative');
	}
	return {
		vcpuMillis: units.cpu * runningMillis,
		memoryGibMillis: units.memoryGiB * runningMillis,
		gpuMillis: units.gpu * runningMillis,
		runningDiskGibMillis: units.diskGiB * runningMillis,
		stoppedDiskGibMillis: units.diskGiB * stoppedMillis,
	};
}

export function intendedQuantities(
	units: AllocationUnits,
	mode: UsageMode,
	durationMillis: bigint
): UsageQuantities {
	return mode === UsageMode.FULL
		? quantitiesFor(units, durationMillis, 0n)
		: quantitiesFor(units, 0n, durationMillis);
}

export function attestedQuantities(
	units: AllocationUnits,
	computeMillis: bigint,
	storageMillis: bigint
): UsageQuantities {
	return quantitiesFor(
		units,
		computeMillis,
		storageMillis > computeMillis ? storageMillis - computeMillis : 0n
	);
}

export function quantityColumns(
	quantities: UsageQuantities
): UsageQuantityColumns {
	return {
		vcpuMillis: fixed(quantities.vcpuMillis, USAGE_RESOURCE_SCALE),
		memoryGibMillis: fixed(quantities.memoryGibMillis, USAGE_RESOURCE_SCALE),
		gpuMillis: fixed(quantities.gpuMillis, USAGE_RESOURCE_SCALE),
		runningDiskGibMillis: fixed(
			quantities.runningDiskGibMillis,
			USAGE_RESOURCE_SCALE
		),
		stoppedDiskGibMillis: fixed(
			quantities.stoppedDiskGibMillis,
			USAGE_RESOURCE_SCALE
		),
	};
}

export function parseQuantityColumns(
	columns: UsageQuantityColumns
): UsageQuantities {
	const parse = (value: string, name: string) =>
		parseFixed(value, USAGE_RESOURCE_SCALE, name);
	return {
		vcpuMillis: parse(columns.vcpuMillis, 'vCPU milliseconds'),
		memoryGibMillis: parse(columns.memoryGibMillis, 'memory milliseconds'),
		gpuMillis: parse(columns.gpuMillis, 'GPU milliseconds'),
		runningDiskGibMillis: parse(
			columns.runningDiskGibMillis,
			'running disk milliseconds'
		),
		stoppedDiskGibMillis: parse(
			columns.stoppedDiskGibMillis,
			'stopped disk milliseconds'
		),
	};
}
