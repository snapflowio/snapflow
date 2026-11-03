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
import { locationCodeLabel } from '#lib/features/locations/lib/location-format.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { formatDate } from '#lib/utils/format.ts';

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

const textParam = z.string().catch('');

export const sandboxListSchema = z.object({
	search: textParam,
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

export function hasActiveSandboxFilters(values: SandboxListValues): boolean {
	return sandboxFilterTags(values).length > 0;
}

type SandboxFilterKey = Exclude<
	keyof SandboxListValues,
	'search' | 'sort' | 'order' | 'cursor' | 'machine'
>;

export interface SandboxFilterTag {
	label: string;
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

export function clearedSandboxParams(
	keys: readonly (keyof SandboxListValues)[]
): SandboxListPatch {
	const patch: SandboxListPatch = { cursor: undefined };
	for (const key of keys) patch[key] = undefined;
	return patch;
}

function multiTag(
	name: string,
	values: readonly string[],
	format: (value: string) => string = (value) => value
): string | null {
	if (values.length === 0) return null;
	const [only] = values;
	return values.length === 1 && only !== undefined
		? `${name}: ${format(only)}`
		: `${name}: ${values.length} selected`;
}

function rangeTag(name: string, min: string, max: string): string | null {
	const low = min.trim();
	const high = max.trim();
	if (low && high) return `${name}: ${low}–${high}`;
	if (low) return `${name}: ≥ ${low}`;
	if (high) return `${name}: ≤ ${high}`;
	return null;
}

function dateTag(name: string, after: string, before: string): string | null {
	const from = dateFilter(after);
	const to = dateFilter(before);
	if (from && to) return `${name}: ${formatDate(from)}–${formatDate(to)}`;
	if (from) return `${name}: after ${formatDate(from)}`;
	if (to) return `${name}: before ${formatDate(to)}`;
	return null;
}

export function sandboxFilterTags(
	values: SandboxListValues
): SandboxFilterTag[] {
	const labelCount = values.labels
		.split('\n')
		.filter((line) => line.trim()).length;
	const candidates: [string | null, readonly SandboxFilterKey[]][] = [
		[multiTag('State', values.state), ['state']],
		[multiTag('Snapshot', values.snapshot), ['snapshot']],
		[multiTag('Location', values.location, locationCodeLabel), ['location']],
		[multiTag('Class', values.class), ['class']],
		[
			values.recoverable === undefined
				? null
				: `Recoverable: ${values.recoverable ? 'Yes' : 'No'}`,
			['recoverable'],
		],
		[rangeTag('CPU', values.minCpu, values.maxCpu), ['minCpu', 'maxCpu']],
		[
			rangeTag('Memory', values.minMemory, values.maxMemory),
			['minMemory', 'maxMemory'],
		],
		[rangeTag('Disk', values.minDisk, values.maxDisk), ['minDisk', 'maxDisk']],
		[
			dateTag('Created', values.createdAtAfter, values.createdAtBefore),
			['createdAtAfter', 'createdAtBefore'],
		],
		[
			dateTag('Last event', values.lastEventAfter, values.lastEventBefore),
			['lastEventAfter', 'lastEventBefore'],
		],
		[labelCount > 0 ? `Labels: ${labelCount}` : null, ['labels']],
		[
			values.includeErroredDeleted ? 'Errored deletions' : null,
			['includeErroredDeleted'],
		],
	];
	return candidates.flatMap(([label, keys]) =>
		label ? [{ label, keys }] : []
	);
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
		states: nonEmpty(values.state),
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
