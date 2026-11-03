/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type GetListingData,
	type GpuType,
	type ListListingsData,
	MachineBrowseSort,
	type MachineCategory,
	type MachineTier,
} from '@snapflow/api-client';
import type { ResourceSortOption } from '#lib/components/resource/resource-options.ts';
import type { ResourceSortDirection } from '#lib/components/resource/table/resource-table-sort.ts';
import {
	usdInputToMicroUsd,
	usdInputToNonNegativeMicroUsd,
} from '#lib/utils/usd.ts';

const DEFAULT_SHAPE_VCPU = 2;
const DEFAULT_SHAPE_MEMORY_GIB = 4;
const DEFAULT_SHAPE_DISK_GIB = 20;
const DEFAULT_SHAPE_GPU = 0;
const MINIMUM_RESOURCE = 1;
const MINIMUM_GPU = 0;
const BASIS_POINTS_PER_PERCENT = 100;
const MAXIMUM_PERCENT = 100;

export type MachineListQuery = NonNullable<ListListingsData['query']>;
export type MachineShapeQuery = NonNullable<GetListingData['query']>;

export interface MachineShapeInput {
	cpu: string;
	diskGiB: string;
	gpu: string;
	gpuType: GpuType[];
	memoryGiB: string;
}

export const DEFAULT_MACHINE_SHAPE: MachineShapeInput = {
	cpu: String(DEFAULT_SHAPE_VCPU),
	diskGiB: String(DEFAULT_SHAPE_DISK_GIB),
	gpu: String(DEFAULT_SHAPE_GPU),
	gpuType: [],
	memoryGiB: String(DEFAULT_SHAPE_MEMORY_GIB),
};

function wholeNumber(value: string, minimum: number): number | undefined {
	if (!value.trim()) return undefined;
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= minimum ? parsed : undefined;
}

export function machineShapeQuery(shape: MachineShapeInput): MachineShapeQuery {
	return {
		cpu: wholeNumber(shape.cpu, MINIMUM_RESOURCE),
		memoryGiB: wholeNumber(shape.memoryGiB, MINIMUM_RESOURCE),
		diskGiB: wholeNumber(shape.diskGiB, MINIMUM_RESOURCE),
		gpu: wholeNumber(shape.gpu, MINIMUM_GPU),
	};
}

export function wantsGpu(shape: MachineShapeInput): boolean {
	return (wholeNumber(shape.gpu, MINIMUM_GPU) ?? MINIMUM_GPU) > MINIMUM_GPU;
}

function machineShapeListQuery(
	shape: MachineShapeInput
): Pick<MachineListQuery, 'cpu' | 'diskGiB' | 'gpu' | 'gpuType' | 'memoryGiB'> {
	return {
		...machineShapeQuery(shape),
		gpuType:
			wantsGpu(shape) && shape.gpuType.length > 0 ? shape.gpuType : undefined,
	};
}

export interface MachineFilters {
	category: MachineCategory | null;
	includeUnavailable: boolean;
	maxHourlyPriceUsd: string;
	maxEgressPriceUsd: string;
	minimumReliabilityPercent: string;
	minimumTier: MachineTier | null;
	persistentVolumes: boolean;
	locations: string[];
}

export const DEFAULT_MACHINE_SORT = MachineBrowseSort.Price;

export const MACHINE_SORT_OPTIONS: readonly ResourceSortOption[] = [
	{ id: MachineBrowseSort.Price, label: 'Price' },
	{ id: MachineBrowseSort.Reliability, label: 'Reliability' },
	{ id: MachineBrowseSort.Performance, label: 'Performance' },
	{ id: MachineBrowseSort.Newest, label: 'Newest' },
	{ id: MachineBrowseSort.Nearest, label: 'Nearest' },
];

export const MACHINE_SORT_DIRECTIONS: Record<
	MachineBrowseSort,
	ResourceSortDirection
> = {
	[MachineBrowseSort.Price]: 'asc',
	[MachineBrowseSort.Reliability]: 'desc',
	[MachineBrowseSort.Performance]: 'desc',
	[MachineBrowseSort.Newest]: 'desc',
	[MachineBrowseSort.Nearest]: 'asc',
};

const SORT_VALUES = new Set<string>(Object.values(MachineBrowseSort));

export function isMachineBrowseSort(value: string): value is MachineBrowseSort {
	return SORT_VALUES.has(value);
}

export function reliabilityPercentToBasisPoints(
	value: string
): number | undefined {
	if (!value.trim()) return undefined;
	const percent = Number(value);
	if (!Number.isFinite(percent) || percent < 0 || percent > MAXIMUM_PERCENT)
		return undefined;
	return Math.round(percent * BASIS_POINTS_PER_PERCENT);
}

interface MachineListQueryInput {
	filters: MachineFilters;
	limit: number;
	shape: MachineShapeInput;
	sort: MachineBrowseSort;
}

export function machineListQuery({
	filters,
	limit,
	shape,
	sort,
}: MachineListQueryInput): MachineListQuery {
	return {
		...machineShapeListQuery(shape),
		category: filters.category ?? undefined,
		locations: filters.locations.length > 0 ? filters.locations : undefined,
		minimumTier: filters.minimumTier ?? undefined,
		maxHourlyPriceMicroUsd:
			usdInputToMicroUsd(filters.maxHourlyPriceUsd) ?? undefined,
		maxEgressMicroUsdPerGiB:
			usdInputToNonNegativeMicroUsd(filters.maxEgressPriceUsd) ?? undefined,
		minimumReliabilityBasisPoints: reliabilityPercentToBasisPoints(
			filters.minimumReliabilityPercent
		),
		persistentVolumes: filters.persistentVolumes || undefined,
		includeUnavailable: filters.includeUnavailable || undefined,
		sort,
		limit,
	};
}
