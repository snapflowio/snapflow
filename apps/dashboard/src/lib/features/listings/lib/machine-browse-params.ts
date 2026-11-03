/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	GpuType,
	MachineBrowseSort,
	MachineCategory,
	MachineTier,
} from '@snapflow/api-client';
import * as z from 'zod';
import { locationCodeLabel } from '#lib/features/locations/lib/location-format.ts';
import { gpuTypeLabel } from '#lib/features/machines/lib/gpu-options.ts';
import {
	type SearchParamsValues,
	searchParamArray,
} from '#lib/routing/search-params.ts';
import {
	usdInputToMicroUsd,
	usdInputToNonNegativeMicroUsd,
} from '#lib/utils/usd.ts';
import {
	MACHINE_CATEGORY_LABELS,
	MACHINE_TIER_LABELS,
} from './listing-format.ts';
import {
	DEFAULT_MACHINE_SHAPE,
	DEFAULT_MACHINE_SORT,
	type MachineFilters,
	type MachineShapeInput,
	reliabilityPercentToBasisPoints,
	wantsGpu,
} from './machine-filters.ts';

export const listingShapeSchema = z.object({
	cpu: z.string().catch(DEFAULT_MACHINE_SHAPE.cpu),
	memoryGiB: z.string().catch(DEFAULT_MACHINE_SHAPE.memoryGiB),
	diskGiB: z.string().catch(DEFAULT_MACHINE_SHAPE.diskGiB),
	gpu: z.string().catch(DEFAULT_MACHINE_SHAPE.gpu),
	gpuType: searchParamArray(z.enum(GpuType)).catch([]),
});

export const machineBrowseSchema = listingShapeSchema.extend({
	search: z.string().catch(''),
	category: z.enum(MachineCategory).nullable().catch(null),
	locations: searchParamArray(z.string()).catch([]),
	minimumTier: z.enum(MachineTier).nullable().catch(null),
	maxHourlyPriceUsd: z.string().catch(''),
	maxEgressPriceUsd: z.string().catch(''),
	minimumReliabilityPercent: z.string().catch(''),
	persistentVolumes: z.stringbool().catch(false),
	includeUnavailable: z.stringbool().catch(false),
	sort: z.enum(MachineBrowseSort).catch(DEFAULT_MACHINE_SORT),
});

export type MachineBrowseParams = SearchParamsValues<
	typeof machineBrowseSchema
>;

export type MachineBrowseKey = keyof MachineBrowseParams;

export const MACHINE_FILTER_KEYS = [
	'category',
	'locations',
	'minimumTier',
	'cpu',
	'memoryGiB',
	'diskGiB',
	'gpu',
	'gpuType',
	'maxHourlyPriceUsd',
	'maxEgressPriceUsd',
	'minimumReliabilityPercent',
	'includeUnavailable',
	'persistentVolumes',
] as const satisfies readonly MachineBrowseKey[];

export function browseShape(
	params: Pick<MachineBrowseParams, keyof MachineShapeInput>
): MachineShapeInput {
	return {
		cpu: params.cpu,
		diskGiB: params.diskGiB,
		gpu: params.gpu,
		gpuType: params.gpuType,
		memoryGiB: params.memoryGiB,
	};
}

export function browseFilters(params: MachineBrowseParams): MachineFilters {
	return {
		category: params.category,
		includeUnavailable: params.includeUnavailable,
		maxHourlyPriceUsd: params.maxHourlyPriceUsd,
		maxEgressPriceUsd: params.maxEgressPriceUsd,
		minimumReliabilityPercent: params.minimumReliabilityPercent,
		minimumTier: params.minimumTier,
		persistentVolumes: params.persistentVolumes,
		locations: params.locations,
	};
}

export interface MachineFilterTag {
	label: string;
	keys: readonly MachineBrowseKey[];
}

function listLabel(prefix: string, labels: readonly string[]): string {
	const [first] = labels;
	return labels.length === 1 && first !== undefined
		? `${prefix}: ${first}`
		: `${prefix}: ${labels.length} selected`;
}

type TagCandidate = MachineFilterTag | null;

function machineTags(params: MachineBrowseParams): TagCandidate[] {
	return [
		params.category
			? {
					label: `Category: ${MACHINE_CATEGORY_LABELS[params.category]}`,
					keys: ['category'],
				}
			: null,
		params.locations.length > 0
			? {
					label: listLabel('Location', params.locations.map(locationCodeLabel)),
					keys: ['locations'],
				}
			: null,
		params.minimumTier
			? {
					label: `Tier: ${MACHINE_TIER_LABELS[params.minimumTier]} or better`,
					keys: ['minimumTier'],
				}
			: null,
	];
}

function shapeTag(
	key: 'cpu' | 'memoryGiB' | 'diskGiB',
	params: MachineBrowseParams,
	label: string
): TagCandidate {
	return params[key] === DEFAULT_MACHINE_SHAPE[key]
		? null
		: { label, keys: [key] };
}

function resourceTags(params: MachineBrowseParams): TagCandidate[] {
	return [
		shapeTag('cpu', params, `Min vCPU: ${params.cpu}`),
		shapeTag('memoryGiB', params, `Min memory: ${params.memoryGiB} GiB`),
		shapeTag('diskGiB', params, `Min disk: ${params.diskGiB} GiB`),
		params.gpu === DEFAULT_MACHINE_SHAPE.gpu
			? null
			: { label: `Min GPUs: ${params.gpu}`, keys: ['gpu', 'gpuType'] },
		wantsGpu(params) && params.gpuType.length > 0
			? {
					label: listLabel('GPU type', params.gpuType.map(gpuTypeLabel)),
					keys: ['gpuType'],
				}
			: null,
	];
}

function egressTag(params: MachineBrowseParams): TagCandidate {
	const maxEgress = usdInputToNonNegativeMicroUsd(params.maxEgressPriceUsd);
	if (maxEgress === null) return null;
	return {
		label:
			BigInt(maxEgress) === 0n
				? 'Egress: Free only'
				: `Max egress: $${params.maxEgressPriceUsd.trim()}/GB`,
		keys: ['maxEgressPriceUsd'],
	};
}

function availabilityTag(params: MachineBrowseParams): TagCandidate {
	const labels = [
		params.includeUnavailable ? 'Include unavailable' : null,
		params.persistentVolumes ? 'Supports volumes' : null,
	].filter((label) => label !== null);
	return labels.length > 0
		? {
				label: listLabel('Availability', labels),
				keys: ['includeUnavailable', 'persistentVolumes'],
			}
		: null;
}

function marketTags(params: MachineBrowseParams): TagCandidate[] {
	return [
		usdInputToMicroUsd(params.maxHourlyPriceUsd)
			? {
					label: `Max price: $${params.maxHourlyPriceUsd.trim()}/h`,
					keys: ['maxHourlyPriceUsd'],
				}
			: null,
		reliabilityPercentToBasisPoints(params.minimumReliabilityPercent) ===
		undefined
			? null
			: {
					label: `Min reliability: ${params.minimumReliabilityPercent.trim()}%`,
					keys: ['minimumReliabilityPercent'],
				},
		egressTag(params),
		availabilityTag(params),
	];
}

export function machineFilterTags(
	params: MachineBrowseParams
): MachineFilterTag[] {
	return [
		...machineTags(params),
		...resourceTags(params),
		...marketTags(params),
	].filter((tag) => tag !== null);
}
