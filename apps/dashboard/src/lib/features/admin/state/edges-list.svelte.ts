/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import KeyRound from '@lucide/svelte/icons/key-round';
import Trash from '@lucide/svelte/icons/trash-2';
import type { EdgeDto } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	adminAllEdgesQueryOptions,
	deleteEdgeMutationOptions,
	reissueEdgeSecretMutationOptions,
	setEdgeStatusMutationOptions,
} from '#lib/api/admin/edges.ts';
import type { CredentialDisplay } from '#lib/components/credentials-modal.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { adminFilter } from '#lib/features/admin/lib/admin-filters.ts';
import {
	copyId,
	matchesFilter,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import {
	EDGE_FILTER_KEYS,
	EDGE_SORT_OPTIONS,
	EDGE_STATUS_ACTIONS,
	EDGE_STATUS_ICONS,
	EDGE_STATUS_OPTIONS,
	edgesSearchSchema,
} from '#lib/features/admin/lib/edges-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';

export class EdgesList {
	readonly #params = new SearchParams(edgesSearchSchema);
	readonly #setStatus = createMutation(() => setEdgeStatusMutationOptions());
	readonly #reissueSecret = createMutation(() =>
		reissueEdgeSecretMutationOptions()
	);

	readonly controls = new AdminListControls(this.#params, {
		sortOptions: EDGE_SORT_OPTIONS,
		filterKeys: EDGE_FILTER_KEYS,
		filterFields: () => [
			adminFilter({
				id: 'status',
				label: 'Status',
				options: EDGE_STATUS_OPTIONS,
				values: this.#params.current.status,
				onChange: (status) => void this.#params.update({ status }),
			}),
		],
	});
	readonly edgesQuery = createQuery(() => adminAllEdgesQueryOptions());
	readonly deleteMutation = createMutation(() => deleteEdgeMutationOptions());

	deleting = $state.raw<EdgeDto | null>(null);
	secret = $state.raw<CredentialDisplay | null>(null);

	readonly #allEdges: readonly EdgeDto[] = $derived.by(
		() => this.edgesQuery.data ?? []
	);
	readonly #edgesById = $derived.by(
		() => new Map(this.#allEdges.map((edge) => [edge.id, edge]))
	);
	readonly edges: readonly EdgeDto[] = $derived.by(() =>
		this.#allEdges.filter(
			(edge) =>
				matchesSearch(this.controls.search.value, [
					edge.id,
					edge.name,
					edge.publicHost,
				]) && matchesFilter(this.#params.current.status, edge.status)
		)
	);

	edgeActions = (edge: EdgeDto): ResourceRowAction[] => [
		...EDGE_STATUS_ACTIONS.map(({ label, status }) => ({
			icon: EDGE_STATUS_ICONS[status],
			label,
			onSelect: () => this.#setStatus.mutate({ edge, status }),
			visible: status !== edge.status,
		})),
		{
			icon: KeyRound,
			label: 'Reissue enrollment secret',
			onSelect: () => this.#reissue(edge),
		},
		{ icon: Copy, label: 'Copy ID', onSelect: () => copyId(edge.id) },
		{
			icon: Trash,
			label: 'Delete',
			onSelect: () => {
				this.deleting = edge;
			},
			separated: true,
		},
	];

	edgeRowActions = (edgeId: string): ResourceRowAction[] => {
		const edge = this.#edgesById.get(edgeId);
		return edge ? this.edgeActions(edge) : [];
	};

	cancelDelete = (): void => {
		this.deleting = null;
	};

	confirmDelete = (edge: EdgeDto): void => {
		this.deleteMutation.mutate(edge, {
			onSuccess: () => {
				this.deleting = null;
			},
		});
	};

	closeSecret = (): void => {
		this.secret = null;
	};

	#reissue(edge: EdgeDto): void {
		this.#reissueSecret.mutate(edge, {
			onSuccess: (issued) => {
				this.secret = {
					title: `Enrollment secret for ${edge.name}`,
					values: [
						{ label: 'Edge ID', value: issued.edgeId },
						{ label: 'Enrollment secret', value: issued.enrollmentSecret },
						{
							label: 'Expires',
							value: formatDateTime(issued.enrollmentSecretExpiresAt),
						},
					],
				};
			},
		});
	}
}
