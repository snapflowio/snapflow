/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	activateSnapshot,
	deactivateSnapshot,
	getAllSnapshots,
	getSnapshotBuildLogsUrl,
	removeSnapshot,
	type SnapshotDto,
} from '@snapflow/api-client';
import {
	createSnapshotMutation,
	getAllSnapshotsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { openResolvedUrlInNewTab } from '#lib/utils/open-new-tab.ts';

const SNAPSHOT_PAGE_SIZE = 100;

export type SnapshotStateAction = 'activate' | 'deactivate';

interface SnapshotStateChange {
	action: SnapshotStateAction;
	snapshot: SnapshotDto;
}

interface SnapshotBulkStateChange {
	action: SnapshotStateAction;
	snapshots: readonly SnapshotDto[];
}

export interface SnapshotSettledCounts {
	failed: number;
	succeeded: number;
}

function changeSnapshotState(
	action: SnapshotStateAction,
	snapshot: SnapshotDto
) {
	const options = { path: { id: snapshot.id } };
	return action === 'activate'
		? activateSnapshot(options)
		: deactivateSnapshot(options);
}

function removeSnapshotById(snapshot: SnapshotDto) {
	return removeSnapshot({ path: { id: snapshot.id } });
}

async function settleAll(
	requests: readonly Promise<unknown>[]
): Promise<SnapshotSettledCounts> {
	const results = await Promise.allSettled(requests);
	return {
		failed: results.filter((result) => result.status === 'rejected').length,
		succeeded: results.filter((result) => result.status === 'fulfilled').length,
	};
}

export function allSnapshotsQueryOptions() {
	return allPagesOptions(
		getAllSnapshotsQueryKey(),
		async (cursor, signal) =>
			(
				await getAllSnapshots({
					query: { cursor, limit: SNAPSHOT_PAGE_SIZE },
					signal,
				})
			).data
	);
}

export function createSnapshotMutationOptions() {
	return mutationOptions({
		...createSnapshotMutation(),
		meta: {
			invalidates: [getAllSnapshotsQueryKey()],
			success: 'Snapshot build started',
			failure: 'Failed to create snapshot',
		},
	});
}

export function snapshotStateMutationOptions() {
	return mutationOptions({
		mutationFn: async ({ action, snapshot }: SnapshotStateChange) => {
			await changeSnapshotState(action, snapshot);
			return action;
		},
		meta: {
			invalidates: [getAllSnapshotsQueryKey()],
			failure: 'Failed to update snapshot',
		},
	});
}

export function removeSnapshotMutationOptions() {
	return mutationOptions({
		mutationFn: async (snapshot: SnapshotDto) => {
			await removeSnapshotById(snapshot);
			return snapshot;
		},
		meta: {
			invalidates: [getAllSnapshotsQueryKey()],
			failure: 'Failed to remove snapshot',
		},
	});
}

export function bulkRemoveSnapshotsMutationOptions() {
	return mutationOptions({
		mutationFn: (snapshots: readonly SnapshotDto[]) =>
			settleAll(snapshots.map(removeSnapshotById)),
		meta: {
			invalidates: [getAllSnapshotsQueryKey()],
			failure: 'Failed to remove snapshots',
		},
	});
}

export function bulkSnapshotStateMutationOptions() {
	return mutationOptions({
		mutationFn: async ({ action, snapshots }: SnapshotBulkStateChange) => ({
			action,
			counts: await settleAll(
				snapshots.map((snapshot) => changeSnapshotState(action, snapshot))
			),
		}),
		meta: {
			invalidates: [getAllSnapshotsQueryKey()],
			failure: 'Failed to update snapshots',
		},
	});
}

export function openSnapshotBuildLogs(snapshot: SnapshotDto): Promise<void> {
	return openResolvedUrlInNewTab(
		async () => {
			const response = await getSnapshotBuildLogsUrl({
				path: { id: snapshot.id },
			});
			return response.data.url;
		},
		(error) => showApiError(error, 'Failed to open snapshot build logs')
	);
}
