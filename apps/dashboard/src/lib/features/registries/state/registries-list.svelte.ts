/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import Copy from '@lucide/svelte/icons/copy';
import Plus from '@lucide/svelte/icons/plus';
import type { DockerRegistry } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	allRegistriesQueryOptions,
	deleteRegistryMutationOptions,
} from '#lib/api/registries.ts';
import Trash from '#lib/components/icons/trash.svelte';
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
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import {
	isRegistryType,
	matchesRegistry,
	REGISTRY_SORT_ACCESSORS,
	REGISTRY_SORT_OPTIONS,
	registriesSearchSchema,
	registryTypeLabel,
} from '#lib/features/registries/lib/registries-list.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export class RegistriesList {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(registriesSearchSchema);
	readonly #clipboard = new CopyToClipboard();

	readonly search = this.#params.text('search');
	readonly registriesQuery = createQuery(() => allRegistriesQueryOptions());
	readonly deleteMutation = createMutation(() =>
		deleteRegistryMutationOptions()
	);

	createOpen = $state(false);
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
			label: `Type: ${registryTypeLabel(type)}`,
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

	openRegistry = (registryId: string): void => {
		void goto(
			resolve('/(app)/(dashboard)/registries/[registryId]', { registryId })
		);
	};

	remove = (registry: DockerRegistry): void => {
		this.deleteMutation.mutate(registry, {
			onSuccess: (removed) => {
				this.deleting = null;
				toast.success(`Deleted ${removed.name}`);
			},
		});
	};

	rowActions = (registry: DockerRegistry): ResourceRowAction[] => [
		{
			icon: ArrowUpRight,
			label: 'Open',
			onSelect: () => this.openRegistry(registry.id),
		},
		{
			icon: Copy,
			label: 'Copy ID',
			onSelect: () => void this.#clipboard.copy(registry.id),
		},
		{
			icon: Trash,
			label: 'Delete',
			onSelect: () => {
				this.deleting = registry;
			},
			separated: true,
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
