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
import { ClientPagination } from '#lib/components/resource/resource-client-pagination.svelte.ts';
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
import { copyWithToast } from '#lib/components/ui/clipboard/copy-with-toast.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import {
	isVolumeState,
	isVolumeView,
	matchesVolume,
	matchesVolumeView,
	VOLUME_SORT_ACCESSORS,
	VOLUME_SORT_OPTIONS,
	VolumeView,
	volumesSearchSchema,
	volumeViewSegments,
} from '#lib/features/volumes/lib/volumes-list.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { pluralize, sentenceCase } from '#lib/utils/text.ts';

const VOLUME_PANEL_PARAM = 'id';

export class VolumesList {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(volumesSearchSchema);
	#lastOpened: VolumeDto | null = null;

	readonly search = this.#params.text('search');
	readonly volumesQuery = createQuery(() => allVolumesQueryOptions());
	readonly deleteMutation = createMutation(() => {
		const options = deleteVolumeMutationOptions();
		return { ...options, meta: { ...options.meta, failure: undefined } };
	});
	readonly bulkDeleteMutation = createMutation(() =>
		bulkDeleteVolumesMutationOptions()
	);

	createOpen = $state(false);
	bulkDeleteOpen = $state(false);
	deleting = $state.raw<VolumeDto | null>(null);

	readonly canWrite = $derived(this.#permission.can({ volumes: ['write'] }));
	readonly canDelete = $derived(this.#permission.can({ volumes: ['delete'] }));
	readonly states = $derived(this.#params.current.state);
	readonly view = $derived(this.#params.current.view);
	readonly #sort = $derived(
		activeSort(this.#params.current.sort, this.#params.current.dir)
	);
	readonly segments = $derived(
		volumeViewSegments(this.volumesQuery.data ?? [])
	);
	readonly volumes: readonly VolumeDto[] = $derived.by(() => {
		const query = this.search.value.trim().toLowerCase();
		const filtered = (this.volumesQuery.data ?? []).filter(
			(volume) =>
				matchesVolume(volume, query, this.states) &&
				matchesVolumeView(volume, this.view)
		);
		return sortRows(filtered, this.#sort, VOLUME_SORT_ACCESSORS);
	});
	readonly pagination = new ClientPagination(
		() => this.volumes,
		() => [this.view, this.states, this.search.value, this.#sort]
	);
	readonly selection = new ResourceSelection(
		() => this.volumes,
		(volume) => volume.id
	);
	readonly panel = new OpenRowParam(
		() => this.volumes,
		(volume) => volume.id,
		{ param: VOLUME_PANEL_PARAM, pushOnSwitch: true }
	);
	readonly panelVolume: VolumeDto | null = $derived.by(() => {
		if (this.panel.row) this.#lastOpened = this.panel.row;
		return this.panel.row ?? this.#lastOpened;
	});
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
			field: 'State',
			value: sentenceCase(state),
			onRemove: () =>
				this.setStates(this.states.filter((value) => value !== state)),
		}))
	);
	readonly narrowingTags: ResourceFilterTag[] = $derived.by(() => {
		const segment = this.segments.find((item) => item.value === this.view);
		if (this.view === VolumeView.All || !segment) return this.filterTags;
		return [
			{
				field: 'View',
				value: segment.label,
				onRemove: () => this.changeView(VolumeView.All),
			},
			...this.filterTags,
		];
	});
	readonly bulkActions: ResourceBulkAction[] = $derived.by(() =>
		this.canDelete
			? [
					{
						id: 'delete',
						label: 'Delete',
						icon: Trash,
						destructive: true,
						shortcut: 'del',
						onSelect: this.confirmBulkDelete,
					},
				]
			: []
	);

	openCreate = (): void => {
		this.createOpen = true;
	};

	changeView = (value: string): void => {
		if (!isVolumeView(value)) return;
		void this.#params.update({
			view: value === VolumeView.All ? undefined : value,
		});
	};

	setStates = (values: readonly string[]): void => {
		void this.#params.update({ state: values.filter(isVolumeState) });
	};

	clearSearchAndFilters = (): void => {
		this.search.value = '';
		void this.#params.update({ search: '', state: [], view: undefined });
	};

	confirmBulkDelete = (): void => {
		if (this.selection.selected.length > 0) this.bulkDeleteOpen = true;
	};

	cancelDelete = (): void => {
		this.deleting = null;
		this.deleteMutation.reset();
	};

	remove = (volume: VolumeDto): void => {
		this.deleteMutation.mutate(volume, {
			onSuccess: (removed) => {
				this.deleting = null;
				if (this.panel.openId === removed.id) this.panel.close();
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
			onSelect: () => void copyWithToast(volume.id, 'volume ID'),
		},
		{
			icon: Trash,
			label: 'Delete',
			destructive: true,
			onSelect: () => {
				this.deleting = volume;
			},
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
					destructive: true,
					onSelect: this.confirmBulkDelete,
					visible: this.canDelete,
				},
			],
			row: this.rowActions,
		});
}
