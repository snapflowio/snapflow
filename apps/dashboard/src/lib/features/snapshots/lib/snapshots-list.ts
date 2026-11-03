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
import { searchParamArray } from '#lib/routing/search-params.ts';
import { sentenceCase } from '#lib/utils/text.ts';

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
