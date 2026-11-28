/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type SnapshotDto, SnapshotState } from '@snapflow/api-client';
import * as z from 'zod';
import {
	type ResourceListSortAccessors,
	type ResourceListSortOption,
	sortColumnSchema,
	sortDirectionSchema,
} from '#lib/components/resource/resource-list.ts';
import type { ResourceSegment } from '#lib/components/resource/resource-options.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { formatBytes } from '#lib/utils/format.ts';
import { sentenceCase } from '#lib/utils/text.ts';

export const SNAPSHOT_PANEL_PARAM = 'id';

export const SnapshotView = {
	All: 'all',
	Ready: 'ready',
	Building: 'building',
	Failed: 'failed',
} as const;

export type SnapshotView = (typeof SnapshotView)[keyof typeof SnapshotView];

const SORT_COLUMNS = ['name', 'state', 'size', 'created'] as const;
type SnapshotSortColumn = (typeof SORT_COLUMNS)[number];

export const SNAPSHOT_SORT_OPTIONS: readonly ResourceListSortOption<SnapshotSortColumn>[] =
	[
		{ id: 'name', label: 'Name' },
		{ id: 'state', label: 'State' },
		{ id: 'size', label: 'Size' },
		{ id: 'created', label: 'Created' },
	];

export const SNAPSHOT_SORT_ACCESSORS: ResourceListSortAccessors<
	SnapshotDto,
	SnapshotSortColumn
> = {
	name: (snapshot) => snapshot.name,
	state: (snapshot) => snapshot.state,
	size: (snapshot) => snapshot.size,
	created: (snapshot) => snapshot.createdAt,
};

export const SNAPSHOT_STATE_OPTIONS = Object.values(SnapshotState).map(
	(state) => ({ label: sentenceCase(state), value: state })
);

const snapshotStateSchema = z.enum(SnapshotState);

export function isSnapshotState(value: string): value is SnapshotState {
	return snapshotStateSchema.safeParse(value).success;
}

export const snapshotsSearchSchema = z.object({
	search: z.string().catch(''),
	view: z.enum(SnapshotView).catch(SnapshotView.All),
	state: searchParamArray(snapshotStateSchema).catch([]),
	sort: sortColumnSchema(SORT_COLUMNS),
	dir: sortDirectionSchema,
});

export function matchesSnapshot(
	snapshot: SnapshotDto,
	search: string,
	states: readonly string[]
): boolean {
	return (
		(states.length === 0 || states.includes(snapshot.state)) &&
		(!search ||
			snapshot.name.toLowerCase().includes(search) ||
			(snapshot.imageName?.toLowerCase().includes(search) ?? false))
	);
}

const VIEW_LABELS: Record<SnapshotView, string> = {
	[SnapshotView.All]: 'All',
	[SnapshotView.Ready]: 'Active',
	[SnapshotView.Building]: 'Building',
	[SnapshotView.Failed]: 'Failed',
};

const VIEW_STATES: Record<
	Exclude<SnapshotView, typeof SnapshotView.All>,
	ReadonlySet<SnapshotState>
> = {
	[SnapshotView.Ready]: new Set([SnapshotState.Active]),
	[SnapshotView.Building]: new Set([
		SnapshotState.Pending,
		SnapshotState.Pulling,
		SnapshotState.Building,
		SnapshotState.Capturing,
	]),
	[SnapshotView.Failed]: new Set([
		SnapshotState.Error,
		SnapshotState.BuildFailed,
	]),
};

const SNAPSHOT_VIEW_VALUES: ReadonlySet<string> = new Set(
	Object.values(SnapshotView)
);

export function isSnapshotView(value: string): value is SnapshotView {
	return SNAPSHOT_VIEW_VALUES.has(value);
}

export function matchesSnapshotView(
	snapshot: SnapshotDto,
	view: SnapshotView
): boolean {
	return view === SnapshotView.All || VIEW_STATES[view].has(snapshot.state);
}

export function snapshotViewSegments(
	snapshots: readonly SnapshotDto[]
): ResourceSegment<SnapshotView>[] {
	return Object.values(SnapshotView).map((view) => ({
		value: view,
		label: VIEW_LABELS[view],
		count:
			view === SnapshotView.All
				? undefined
				: snapshots.filter((snapshot) => matchesSnapshotView(snapshot, view))
						.length,
	}));
}

const BYTES_PER_GIBIBYTE = 1_073_741_824;

export function formatSnapshotSize(sizeGibibytes: number): string {
	return formatBytes(Math.round(sizeGibibytes * BYTES_PER_GIBIBYTE));
}

export const SNAPSHOT_IMAGE_TAIL_CHARACTERS = 16;
export const SNAPSHOT_SEARCH_PLACEHOLDER = 'Search snapshots...';
