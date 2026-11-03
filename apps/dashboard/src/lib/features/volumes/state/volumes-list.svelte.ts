/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import Plus from '@lucide/svelte/icons/plus';
import type { VolumeDto } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	allVolumesQueryOptions,
	bulkDeleteVolumesMutationOptions,
	deleteVolumeMutationOptions,
} from '#lib/api/volumes.ts';
import Trash from '#lib/components/icons/trash.svelte';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import {
	activeSort,
	resourceListSortConfig,
	sortRows,
} from '#lib/components/resource/resource-list.ts';
import type {
	ResourceFilterTag,
	ResourceSortConfig,
} from '#lib/components/resource/resource-options.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { ResourceSelection } from '#lib/components/resource/resource-selection.svelte.ts';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import {
	isVolumeState,
	matchesVolume,
	VOLUME_SORT_ACCESSORS,
	VOLUME_SORT_OPTIONS,
	volumesSearchSchema,
} from '#lib/features/volumes/lib/volumes-list.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { pluralize, sentenceCase } from '#lib/utils/text.ts';

export class VolumesList {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(volumesSearchSchema);
	readonly #clipboard = new CopyToClipboard();

	readonly search = this.#params.text('search');
	readonly volumesQuery = createQuery(() => allVolumesQueryOptions());
	readonly deleteMutation = createMutation(() => deleteVolumeMutationOptions());
	readonly bulkDeleteMutation = createMutation(() =>
		bulkDeleteVolumesMutationOptions()
	);

	createOpen = $state(false);
	bulkDeleteOpen = $state(false);
	deleting = $state.raw<VolumeDto | null>(null);

	readonly canWrite = $derived(this.#permission.can({ volumes: ['write'] }));
	readonly canDelete = $derived(this.#permission.can({ volumes: ['delete'] }));
	readonly states = $derived(this.#params.current.state);
	readonly #sort = $derived(
		activeSort(this.#params.current.sort, this.#params.current.dir)
	);
	readonly volumes: readonly VolumeDto[] = $derived.by(() => {
		const query = this.search.value.trim().toLowerCase();
		const filtered = (this.volumesQuery.data ?? []).filter((volume) =>
			matchesVolume(volume, query, this.states)
		);
		return sortRows(filtered, this.#sort, VOLUME_SORT_ACCESSORS);
	});
	readonly selection = new ResourceSelection(
		() => this.volumes,
		(volume) => volume.id
	);
	readonly bulkDeleteTarget: readonly VolumeDto[] | null = $derived(
		this.bulkDeleteOpen ? this.selection.selected : null
	);
	readonly sortConfig: ResourceSortConfig = $derived(
		resourceListSortConfig(
			VOLUME_SORT_OPTIONS,
			this.#sort,
			(column, direction) => {
				void this.#params.update({ sort: column, dir: direction });
			}
		)
	);
	readonly filterTags: ResourceFilterTag[] = $derived(
		this.states.map((state) => ({
			label: `State: ${sentenceCase(state)}`,
			onRemove: () =>
				this.setStates(this.states.filter((value) => value !== state)),
		}))
	);
	readonly bulkActions: ResourceBulkAction[] = $derived.by(() =>
		this.canDelete
			? [
					{
						id: 'delete',
						label: 'Delete',
						icon: Trash,
						destructive: true,
						onSelect: this.confirmBulkDelete,
					},
				]
			: []
	);

	openCreate = (): void => {
		this.createOpen = true;
	};

	setStates = (values: readonly string[]): void => {
		void this.#params.update({ state: values.filter(isVolumeState) });
	};

	clearSearchAndFilters = (): void => {
		this.search.value = '';
		void this.#params.update({ search: '', state: [] });
	};

	confirmBulkDelete = (): void => {
		if (this.selection.selected.length > 0) this.bulkDeleteOpen = true;
	};

	remove = (volume: VolumeDto): void => {
		this.deleteMutation.mutate(volume, {
			onSuccess: (removed) => {
				this.deleting = null;
				toast.success(`Deleted ${removed.name}`);
			},
		});
	};

	removeSelected = (): void => {
		this.bulkDeleteMutation.mutate(this.selection.selected, {
			onSuccess: ({ failed, succeeded }) => {
				this.selection.clear();
				this.bulkDeleteOpen = false;
				const message = `${pluralize(succeeded, 'volume')} deleted`;
				if (failed > 0) toast.error(`${message}; ${failed} failed`);
				else toast.success(message);
			},
		});
	};

	rowActions = (volume: VolumeDto): ResourceRowAction[] => [
		{
			icon: Copy,
			label: 'Copy ID',
			onSelect: () => void this.#clipboard.copy(volume.id),
		},
		{
			icon: Trash,
			label: 'Delete',
			onSelect: () => {
				this.deleting = volume;
			},
			separated: true,
			visible: this.canDelete,
		},
	];

	contextActions = (rowId: string | null): ResourceRowAction[] =>
		this.selection.contextActions(rowId, {
			empty: () => [
				{
					icon: Plus,
					label: 'New volume',
					onSelect: this.openCreate,
					visible: this.canWrite,
				},
			],
			selection: () => [
				{
					icon: Trash,
					label: `Delete ${pluralize(this.selection.selected.length, 'volume')}`,
					onSelect: this.confirmBulkDelete,
					visible: this.canDelete,
				},
			],
			row: this.rowActions,
		});
}
