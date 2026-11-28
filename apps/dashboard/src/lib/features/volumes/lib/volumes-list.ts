/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type VolumeDto, VolumeState } from '@snapflow/api-client';
import * as z from 'zod';
import {
	type ResourceListSortAccessors,
	type ResourceListSortOption,
	sortColumnSchema,
	sortDirectionSchema,
} from '#lib/components/resource/resource-list.ts';
import type { ResourceSegment } from '#lib/components/resource/resource-options.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { sentenceCase } from '#lib/utils/text.ts';

export const VolumeView = {
	All: 'all',
	Ready: 'ready',
	Changing: 'changing',
	Failed: 'failed',
} as const;

export type VolumeView = (typeof VolumeView)[keyof typeof VolumeView];

const VIEW_LABELS: Record<VolumeView, string> = {
	[VolumeView.All]: 'All',
	[VolumeView.Ready]: 'Ready',
	[VolumeView.Changing]: 'Changing',
	[VolumeView.Failed]: 'Failed',
};

const VIEW_STATES: Record<
	Exclude<VolumeView, typeof VolumeView.All>,
	ReadonlySet<VolumeState>
> = {
	[VolumeView.Ready]: new Set([VolumeState.Ready]),
	[VolumeView.Changing]: new Set([
		VolumeState.Resizing,
		VolumeState.Restoring,
		VolumeState.PendingDelete,
		VolumeState.Deleting,
	]),
	[VolumeView.Failed]: new Set([VolumeState.Error]),
};

const VOLUME_VIEW_VALUES: ReadonlySet<string> = new Set(
	Object.values(VolumeView)
);

export function isVolumeView(value: string): value is VolumeView {
	return VOLUME_VIEW_VALUES.has(value);
}

export function matchesVolumeView(
	volume: VolumeDto,
	view: VolumeView
): boolean {
	return view === VolumeView.All || VIEW_STATES[view].has(volume.state);
}

export function volumeViewSegments(
	volumes: readonly VolumeDto[]
): ResourceSegment<VolumeView>[] {
	return Object.values(VolumeView).map((view) => ({
		value: view,
		label: VIEW_LABELS[view],
		count:
			view === VolumeView.All
				? undefined
				: volumes.filter((volume) => matchesVolumeView(volume, view)).length,
	}));
}

export const VOLUME_SEARCH_PLACEHOLDER = 'Search volumes...';

const SORT_COLUMNS = ['name', 'state', 'size', 'lastUsed', 'created'] as const;
type VolumeSortColumn = (typeof SORT_COLUMNS)[number];

export const VOLUME_SORT_OPTIONS: readonly ResourceListSortOption<VolumeSortColumn>[] =
	[
		{ id: 'name', label: 'Name' },
		{ id: 'state', label: 'State' },
		{ id: 'size', label: 'Size' },
		{ id: 'lastUsed', label: 'Last used' },
		{ id: 'created', label: 'Created' },
	];

export const VOLUME_SORT_ACCESSORS: ResourceListSortAccessors<
	VolumeDto,
	VolumeSortColumn
> = {
	name: (volume) => volume.name,
	state: (volume) => volume.state,
	size: (volume) => volume.sizeGiB,
	lastUsed: (volume) => volume.lastUsedAt ?? '',
	created: (volume) => volume.createdAt,
};

export const VOLUME_STATE_OPTIONS = Object.values(VolumeState).map((state) => ({
	label: sentenceCase(state),
	value: state,
}));

const volumeStateSchema = z.enum(VolumeState);

export function isVolumeState(value: string): value is VolumeState {
	return volumeStateSchema.safeParse(value).success;
}

export const volumesSearchSchema = z.object({
	search: z.string().catch(''),
	view: z.enum(VolumeView).catch(VolumeView.All),
	state: searchParamArray(volumeStateSchema).catch([]),
	sort: sortColumnSchema(SORT_COLUMNS),
	dir: sortDirectionSchema,
});

export function matchesVolume(
	volume: VolumeDto,
	search: string,
	states: readonly string[]
): boolean {
	return (
		(states.length === 0 || states.includes(volume.state)) &&
		(!search ||
			volume.id.toLowerCase().includes(search) ||
			volume.name.toLowerCase().includes(search) ||
			(volume.errorReason?.toLowerCase().includes(search) ?? false))
	);
}
