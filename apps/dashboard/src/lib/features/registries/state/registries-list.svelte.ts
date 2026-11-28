/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import Pencil from '@lucide/svelte/icons/pencil';
import Plus from '@lucide/svelte/icons/plus';
import type {
	DockerRegistry,
	UpdateDockerRegistry,
} from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	allRegistriesQueryOptions,
	deleteRegistryMutationOptions,
	updateRegistryMutationOptions,
} from '#lib/api/registries.ts';
import Trash from '#lib/components/icons/trash.svelte';
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
import { copyWithToast } from '#lib/components/ui/clipboard/copy-with-toast.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import {
	isRegistryType,
	matchesRegistry,
	REGISTRY_PANEL_PARAM,
	REGISTRY_SORT_ACCESSORS,
	REGISTRY_SORT_OPTIONS,
	registriesSearchSchema,
	registryTypeLabel,
} from '#lib/features/registries/lib/registries-list.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class RegistriesList {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(registriesSearchSchema);
	#lastOpened: DockerRegistry | null = null;

	readonly search = this.#params.text('search');
	readonly registriesQuery = createQuery(() => allRegistriesQueryOptions());
	readonly deleteMutation = createMutation(() => {
		const options = deleteRegistryMutationOptions();
		return { ...options, meta: { ...options.meta, failure: undefined } };
	});
	readonly updateMutation = createMutation(() =>
		updateRegistryMutationOptions()
	);

	createOpen = $state(false);
	editing = $state.raw<DockerRegistry | null>(null);
	deleting = $state.raw<DockerRegistry | null>(null);

	readonly canWrite = $derived(this.#permission.can({ registries: ['write'] }));
	readonly canDelete = $derived(
		this.#permission.can({ registries: ['delete'] })
	);
	readonly types = $derived(this.#params.current.type);
	readonly #sort = $derived(
		activeSort(this.#params.current.sort, this.#params.current.dir)
	);
	readonly registries: readonly DockerRegistry[] = $derived.by(() => {
		const query = this.search.value.trim().toLowerCase();
		const filtered = (this.registriesQuery.data ?? []).filter((registry) =>
			matchesRegistry(registry, query, this.types)
		);
		return sortRows(filtered, this.#sort, REGISTRY_SORT_ACCESSORS);
	});
	readonly pagination = new ClientPagination(
		() => this.registries,
		() => [this.types, this.search.value, this.#sort]
	);
	readonly panel = new OpenRowParam(
		() => this.registries,
		(registry) => registry.id,
		{ param: REGISTRY_PANEL_PARAM, pushOnSwitch: true }
	);
	readonly panelRegistry: DockerRegistry | null = $derived.by(() => {
		if (this.panel.row) this.#lastOpened = this.panel.row;
		return this.panel.row ?? this.#lastOpened;
	});
	readonly sortConfig: ResourceSortConfig = $derived(
		resourceListSortConfig(
			REGISTRY_SORT_OPTIONS,
			this.#sort,
			(column, direction) => {
				void this.#params.update({ sort: column, dir: direction });
			}
		)
	);
	readonly filterTags: ResourceFilterTag[] = $derived.by(() =>
		this.types.map((type) => ({
			field: 'Type',
			value: registryTypeLabel(type),
			onRemove: () =>
				this.setTypes(this.types.filter((value) => value !== type)),
		}))
	);

	openCreate = (): void => {
		this.createOpen = true;
	};

	setTypes = (values: readonly string[]): void => {
		void this.#params.update({ type: values.filter(isRegistryType) });
	};

	clearSearchAndFilters = (): void => {
		this.search.value = '';
		void this.#params.update({ search: '', type: [] });
	};

	saveEdit = async (body: UpdateDockerRegistry): Promise<void> => {
		const registry = this.editing;
		if (!registry) return;
		await this.updateMutation.mutateAsync({
			path: { id: registry.id },
			body,
		});
		this.editing = null;
	};

	cancelDelete = (): void => {
		this.deleting = null;
		this.deleteMutation.reset();
	};

	remove = (registry: DockerRegistry): void => {
		this.deleteMutation.mutate(registry, {
			onSuccess: (removed) => {
				this.deleting = null;
				if (this.panel.openId === removed.id) this.panel.close();
				toast.success(`Deleted ${removed.name}`);
			},
		});
	};

	rowActions = (registry: DockerRegistry): ResourceRowAction[] => [
		{
			icon: Pencil,
			label: 'Edit',
			onSelect: () => {
				this.editing = registry;
			},
			visible: this.canWrite,
		},
		{
			icon: Copy,
			label: 'Copy ID',
			onSelect: () => void copyWithToast(registry.id, 'registry ID'),
		},
		{
			icon: Trash,
			label: 'Delete',
			destructive: true,
			onSelect: () => {
				this.deleting = registry;
			},
			visible: this.canDelete,
		},
	];

	contextActions = (rowId: string | null): ResourceRowAction[] => {
		if (rowId === null) {
			return [
				{
					icon: Plus,
					label: 'New registry',
					onSelect: this.openCreate,
					visible: this.canWrite,
				},
			];
		}
		const registry = this.registries.find(
			(candidate) => candidate.id === rowId
		);
		return registry ? this.rowActions(registry) : [];
	};
}
