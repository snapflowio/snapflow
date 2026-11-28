/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	deleteVolume,
	listVolumes,
	type VolumeDto,
} from '@snapflow/api-client';
import {
	createVolumeMutation,
	listVolumesQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';

export interface BulkDeleteResult {
	failed: number;
	succeeded: number;
}

export function allVolumesQueryOptions() {
	return allPagesOptions(
		listVolumesQueryKey(),
		async (cursor, signal) =>
			(await listVolumes({ query: { cursor }, signal })).data
	);
}

export function createVolumeMutationOptions() {
	return mutationOptions({
		...createVolumeMutation(),
		meta: {
			invalidates: [listVolumesQueryKey()],
			success: 'Volume created',
			failure: 'Failed to create volume',
		},
	});
}

export function deleteVolumeMutationOptions() {
	return mutationOptions({
		mutationFn: async (volume: VolumeDto) => {
			await deleteVolume({ path: { volumeId: volume.id } });
			return volume;
		},
		meta: {
			invalidates: [listVolumesQueryKey()],
			failure: 'Failed to delete volume',
		},
	});
}

export function bulkDeleteVolumesMutationOptions() {
	return mutationOptions({
		mutationFn: async (volumes: VolumeDto[]): Promise<BulkDeleteResult> => {
			const results = await Promise.allSettled(
				volumes.map((volume) => deleteVolume({ path: { volumeId: volume.id } }))
			);
			return {
				failed: results.filter((result) => result.status === 'rejected').length,
				succeeded: results.filter((result) => result.status === 'fulfilled')
					.length,
			};
		},
		meta: {
			invalidates: [listVolumesQueryKey()],
			failure: 'Failed to delete volumes',
		},
	});
}
