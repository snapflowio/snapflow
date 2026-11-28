/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type ListSandboxesData,
	SandboxClass,
	SandboxListSortDirection,
	SandboxListSortField,
	SandboxState,
} from '@snapflow/api-client';
import * as z from 'zod';
import type { ResourceSegment } from '#lib/components/resource/resource-options.ts';
import { locationCodeLabel } from '#lib/features/locations/lib/location-format.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { formatDate } from '#lib/utils/format.ts';
import { sandboxClassLabel, sandboxStateLabel } from './sandbox-state.ts';

const SANDBOX_PAGE_SIZE = 100;
const MINIMUM_RESOURCE_FILTER = 1;

const SANDBOX_SORT_FIELDS = [
	SandboxListSortField.Name,
	SandboxListSortField.LastActivityAt,
	SandboxListSortField.CreatedAt,
] as const;

export const SANDBOX_SORT_OPTIONS = [
	{ id: SandboxListSortField.Name, label: 'Name' },
	{ id: SandboxListSortField.LastActivityAt, label: 'Last activity' },
	{ id: SandboxListSortField.CreatedAt, label: 'Created' },
];

export const SandboxView = {
	All: 'all',
	Running: 'running',
	Stopped: 'stopped',
	Attention: 'attention',
} as const;

export type SandboxView = (typeof SandboxView)[keyof typeof SandboxView];

export const SANDBOX_VIEW_SEGMENTS: readonly ResourceSegment<SandboxView>[] = [
	{ value: SandboxView.All, label: 'All' },
	{ value: SandboxView.Running, label: 'Running' },
	{ value: SandboxView.Stopped, label: 'Stopped' },
	{ value: SandboxView.Attention, label: 'Needs attention' },
];

const VIEW_STATES: Record<
	Exclude<SandboxView, typeof SandboxView.All>,
	SandboxState[]
> = {
	[SandboxView.Running]: [SandboxState.Started],
	[SandboxView.Stopped]: [
		SandboxState.Stopped,
		SandboxState.Paused,
		SandboxState.Archived,
	],
	[SandboxView.Attention]: [
		SandboxState.Error,
		SandboxState.BuildFailed,
		SandboxState.MachineUnavailable,
	],
};

const SANDBOX_VIEW_VALUES = new Set<string>(Object.values(SandboxView));

export function isSandboxView(value: string): value is SandboxView {
	return SANDBOX_VIEW_VALUES.has(value);
}

const textParam = z.string().catch('');

export const sandboxListSchema = z.object({
	search: textParam,
	view: z.enum(SandboxView).catch(SandboxView.All),
	state: searchParamArray(z.enum(SandboxState)).catch([]),
	snapshot: searchParamArray(z.string()).catch([]),
	location: searchParamArray(z.string()).catch([]),
	class: searchParamArray(z.enum(SandboxClass)).catch([]),
	recoverable: z.stringbool().optional().catch(undefined),
	minCpu: textParam,
	maxCpu: textParam,
	minMemory: textParam,
	maxMemory: textParam,
	minDisk: textParam,
	maxDisk: textParam,
	createdAtAfter: textParam,
	createdAtBefore: textParam,
	lastEventAfter: textParam,
	lastEventBefore: textParam,
	labels: textParam,
	includeErroredDeleted: z.stringbool().catch(false),
	sort: z.enum(SANDBOX_SORT_FIELDS).catch(SandboxListSortField.LastActivityAt),
	order: z.enum(SandboxListSortDirection).catch(SandboxListSortDirection.Desc),
	cursor: searchParamArray(z.string()).catch([]),
	machine: z.string().min(1).optional().catch(undefined),
	preset: z.string().min(1).optional().catch(undefined),
	create: z.stringbool().optional().catch(undefined),
});

export type SandboxListValues = z.output<typeof sandboxListSchema>;

export type SandboxTextFilterKey = {
	[Key in keyof SandboxListValues]-?: SandboxListValues[Key] extends string
		? Key
		: never;
}[keyof SandboxListValues];

export function isSandboxSortField(
	value: string
): value is (typeof SANDBOX_SORT_FIELDS)[number] {
	return SANDBOX_SORT_FIELDS.some((field) => field === value);
}

function nonEmpty<T>(values: readonly T[]): T[] | undefined {
	return values.length > 0 ? [...values] : undefined;
}

function numberFilter(value: string): number | undefined {
	if (!value.trim()) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= MINIMUM_RESOURCE_FILTER
		? parsed
		: undefined;
}

function dateFilter(value: string): string | undefined {
	if (!value) return undefined;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function labelFilterJson(value: string): string | undefined {
	const lines = value
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length === 0) return undefined;

	const labels: Record<string, string> = {};
	for (const line of lines) {
		const separator = line.indexOf('=');
		if (separator <= 0) return undefined;
		const key = line.slice(0, separator).trim();
		const labelValue = line.slice(separator + 1).trim();
		if (!key || !labelValue) return undefined;
		labels[key] = labelValue;
	}
	return JSON.stringify(labels);
}

type SandboxFilterKey = Exclude<
	keyof SandboxListValues,
	| 'search'
	| 'view'
	| 'sort'
	| 'order'
	| 'cursor'
	| 'machine'
	| 'preset'
	| 'create'
>;

export interface SandboxFilterTag {
	field: string;
	value: string;
	keys: readonly SandboxFilterKey[];
}

export type SandboxListPatch = {
	-readonly [Key in keyof SandboxListValues]?: undefined;
};

export const SANDBOX_FILTER_KEYS: readonly SandboxFilterKey[] = [
	'state',
	'snapshot',
	'location',
	'class',
	'recoverable',
	'minCpu',
	'maxCpu',
	'minMemory',
	'maxMemory',
	'minDisk',
	'maxDisk',
	'createdAtAfter',
	'createdAtBefore',
	'lastEventAfter',
	'lastEventBefore',
	'labels',
	'includeErroredDeleted',
];

export const SANDBOX_MORE_FILTER_KEYS: readonly SandboxFilterKey[] = [
	'snapshot',
	'recoverable',
	'minCpu',
	'maxCpu',
	'minMemory',
	'maxMemory',
	'minDisk',
	'maxDisk',
	'createdAtAfter',
	'createdAtBefore',
	'lastEventAfter',
	'lastEventBefore',
	'labels',
	'includeErroredDeleted',
];

export function clearedSandboxParams(
	keys: readonly (keyof SandboxListValues)[]
): SandboxListPatch {
	const patch: SandboxListPatch = { cursor: undefined };
	for (const key of keys) patch[key] = undefined;
	return patch;
}

function multiValue<TValue extends string>(
	values: readonly TValue[],
	format: (value: TValue) => string = (value) => value
): string | null {
	if (values.length === 0) return null;
	const [only] = values;
	return values.length === 1 && only !== undefined
		? format(only)
		: `${values.length} selected`;
}

function booleanValue(value: boolean | undefined): string | null {
	if (value === undefined) return null;
	return value ? 'Yes' : 'No';
}

function rangeValue(min: string, max: string): string | null {
	const low = min.trim();
	const high = max.trim();
	if (low && high) return `${low}–${high}`;
	if (low) return `≥ ${low}`;
	if (high) return `≤ ${high}`;
	return null;
}

function dateValue(after: string, before: string): string | null {
	const from = dateFilter(after);
	const to = dateFilter(before);
	if (from && to) return `${formatDate(from)}–${formatDate(to)}`;
	if (from) return `after ${formatDate(from)}`;
	if (to) return `before ${formatDate(to)}`;
	return null;
}

export function sandboxFilterTags(
	values: SandboxListValues
): SandboxFilterTag[] {
	const labelCount = values.labels
		.split('\n')
		.filter((line) => line.trim()).length;
	const candidates: [string, string | null, readonly SandboxFilterKey[]][] = [
		['State', multiValue(values.state, sandboxStateLabel), ['state']],
		['Snapshot', multiValue(values.snapshot), ['snapshot']],
		['Location', multiValue(values.location, locationCodeLabel), ['location']],
		['Class', multiValue(values.class, sandboxClassLabel), ['class']],
		['Recoverable', booleanValue(values.recoverable), ['recoverable']],
		['CPU', rangeValue(values.minCpu, values.maxCpu), ['minCpu', 'maxCpu']],
		[
			'Memory',
			rangeValue(values.minMemory, values.maxMemory),
			['minMemory', 'maxMemory'],
		],
		[
			'Disk',
			rangeValue(values.minDisk, values.maxDisk),
			['minDisk', 'maxDisk'],
		],
		[
			'Created',
			dateValue(values.createdAtAfter, values.createdAtBefore),
			['createdAtAfter', 'createdAtBefore'],
		],
		[
			'Last event',
			dateValue(values.lastEventAfter, values.lastEventBefore),
			['lastEventAfter', 'lastEventBefore'],
		],
		['Labels', labelCount > 0 ? String(labelCount) : null, ['labels']],
		[
			'Deleted',
			values.includeErroredDeleted ? 'Errored included' : null,
			['includeErroredDeleted'],
		],
	];
	return candidates.flatMap(([field, value, keys]) =>
		value ? [{ field, value, keys }] : []
	);
}

export function hasActiveSandboxFilters(values: SandboxListValues): boolean {
	return sandboxFilterTags(values).length > 0;
}

export function hasActiveMoreFilters(values: SandboxListValues): boolean {
	return sandboxFilterTags(values).some((tag) =>
		tag.keys.some((key) => SANDBOX_MORE_FILTER_KEYS.includes(key))
	);
}

function viewStates(values: SandboxListValues): SandboxState[] | undefined {
	return values.view === SandboxView.All
		? nonEmpty(values.state)
		: VIEW_STATES[values.view];
}

export function listSandboxesQuery(
	values: SandboxListValues
): NonNullable<ListSandboxesData['query']> {
	return {
		cursor: values.cursor.at(-1),
		limit: SANDBOX_PAGE_SIZE,
		name: values.search.trim() || undefined,
		labels: labelFilterJson(values.labels),
		includeErroredDeleted: values.includeErroredDeleted || undefined,
		states: viewStates(values),
		snapshots: nonEmpty(values.snapshot),
		locations: nonEmpty(values.location),
		sandboxClasses: nonEmpty(values.class),
		minCpu: numberFilter(values.minCpu),
		maxCpu: numberFilter(values.maxCpu),
		minMemoryGiB: numberFilter(values.minMemory),
		maxMemoryGiB: numberFilter(values.maxMemory),
		minDiskGiB: numberFilter(values.minDisk),
		maxDiskGiB: numberFilter(values.maxDisk),
		isRecoverable: values.recoverable,
		createdAtAfter: dateFilter(values.createdAtAfter),
		createdAtBefore: dateFilter(values.createdAtBefore),
		lastEventAfter: dateFilter(values.lastEventAfter),
		lastEventBefore: dateFilter(values.lastEventBefore),
		sort: values.sort,
		order: values.order,
	};
}
