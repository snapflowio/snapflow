/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	adminDeleteEdge,
	adminListEdges,
	adminReissueEdgeEnrollmentSecret,
	adminUpdateEdgeStatus,
	type EdgeDto,
	type EdgeStatus,
} from '@snapflow/api-client';
import { adminListEdgesQueryKey } from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';

interface EdgeStatusChange {
	edge: EdgeDto;
	status: EdgeStatus;
}

const invalidates = [adminListEdgesQueryKey()];

export function adminAllEdgesQueryOptions() {
	return allPagesOptions(
		adminListEdgesQueryKey(),
		async (cursor, signal) =>
			(await adminListEdges({ query: { cursor }, signal })).data
	);
}

export function setEdgeStatusMutationOptions() {
	return mutationOptions({
		mutationFn: ({ edge, status }: EdgeStatusChange) =>
			adminUpdateEdgeStatus({ path: { id: edge.id }, body: { status } }),
		meta: {
			success: 'Edge status updated',
			failure: 'Failed to update edge status',
			invalidates,
		},
	});
}

export function reissueEdgeSecretMutationOptions() {
	return mutationOptions({
		mutationFn: async (edge: EdgeDto) =>
			(await adminReissueEdgeEnrollmentSecret({ path: { id: edge.id } })).data,
		meta: { failure: 'Failed to issue an enrollment secret', invalidates },
	});
}

export function deleteEdgeMutationOptions() {
	return mutationOptions({
		mutationFn: (edge: EdgeDto) => adminDeleteEdge({ path: { id: edge.id } }),
		meta: {
			success: 'Edge deleted',
			failure: 'Failed to delete edge',
			invalidates,
		},
	});
}
