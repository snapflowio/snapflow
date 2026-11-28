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
import type {
	CreateEdgeResponseDto,
	EdgeDto,
	EdgeEnrollmentSecretDto,
} from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	adminAllEdgesQueryOptions,
	deleteEdgeMutationOptions,
	reissueEdgeSecretMutationOptions,
	setEdgeStatusMutationOptions,
} from '#lib/api/admin/edges.ts';
import type { CredentialDisplay } from '#lib/components/credentials-modal.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { adminFilter } from '#lib/features/admin/lib/admin-filters.ts';
import {
	copyId,
	matchesFilter,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import {
	EDGE_CONFIRM_STATUS,
	EDGE_FILTER_KEYS,
	EDGE_SORT_OPTIONS,
	EDGE_STATUS_ACTIONS,
	EDGE_STATUS_ICONS,
	EDGE_STATUS_OPTIONS,
	type EdgeConfirmation,
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

	creating = $state(false);
	deleting = $state.raw<EdgeDto | null>(null);
	confirming = $state.raw<EdgeConfirmation | null>(null);
	secret = $state.raw<CredentialDisplay | null>(null);

	readonly confirmPending: boolean = $derived.by(
		() => this.#setStatus.isPending || this.#reissueSecret.isPending
	);

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
		...EDGE_STATUS_ACTIONS.map(({ label, status, confirm }) => ({
			icon: EDGE_STATUS_ICONS[status],
			label,
			onSelect: () => {
				if (confirm) this.confirming = { edge, action: confirm };
				else this.#setStatus.mutate({ edge, status });
			},
			disabled: this.#setStatus.isPending,
			visible: status !== edge.status,
		})),
		{
			icon: KeyRound,
			label: 'Reissue enrollment secret',
			onSelect: () => {
				this.confirming = { edge, action: 'reissue' };
			},
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

	cancelConfirmation = (): void => {
		this.confirming = null;
	};

	confirmAction = ({ edge, action }: EdgeConfirmation): void => {
		if (action === 'reissue') {
			this.#reissue(edge);
			return;
		}
		this.#setStatus.mutate(
			{ edge, status: EDGE_CONFIRM_STATUS[action] },
			{
				onSuccess: () => {
					this.confirming = null;
				},
			}
		);
	};

	showCreated = (edge: CreateEdgeResponseDto): void => {
		this.#showSecret(edge.name, {
			edgeId: edge.id,
			enrollmentSecret: edge.enrollmentSecret,
			enrollmentSecretExpiresAt: edge.enrollmentSecretExpiresAt,
		});
	};

	#reissue(edge: EdgeDto): void {
		this.#reissueSecret.mutate(edge, {
			onSuccess: (issued) => {
				this.confirming = null;
				this.#showSecret(edge.name, issued);
			},
		});
	}

	#showSecret(name: string, issued: EdgeEnrollmentSecretDto): void {
		this.secret = {
			title: `Enrollment secret for ${name}`,
			values: [
				{ label: 'Edge ID', value: issued.edgeId },
				{ label: 'Enrollment secret', value: issued.enrollmentSecret },
				{
					label: 'Expires',
					value: formatDateTime(issued.enrollmentSecretExpiresAt),
				},
			],
		};
	}
}
