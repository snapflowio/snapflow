/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxListSortDirection } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { machineLocationsQueryOptions } from '#lib/api/locations.ts';
import {
	organizationLimitsQueryOptions,
	organizationUsageQueryOptions,
} from '#lib/api/organizations/limits.ts';
import {
	deleteSandboxMutationOptions,
	type SandboxLifecycleAction,
	sandboxBulkMutationOptions,
	sandboxLifecycleMutationOptions,
	sandboxListQueryOptions,
} from '#lib/api/sandboxes/sandboxes.ts';
import { allSnapshotsQueryOptions } from '#lib/api/snapshots.ts';
import type {
	ResourceFilterTag,
	ResourceSortConfig,
} from '#lib/components/resource/resource-options.ts';
import type { CursorResourcePaginationConfig } from '#lib/components/resource/resource-pagination.ts';
import type { ResourceSortDirection } from '#lib/components/resource/table/resource-table-sort.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import type { SandboxActionRequest } from '#lib/features/sandboxes/components/sandbox-action-confirm-modal.svelte';
import {
	bulkResultMessage,
	SANDBOX_ACTION_COPY,
} from '#lib/features/sandboxes/lib/sandbox-list-actions.ts';
import {
	clearedSandboxParams,
	isSandboxSortField,
	listSandboxesQuery,
	SANDBOX_FILTER_KEYS,
	SANDBOX_SORT_OPTIONS,
	sandboxFilterTags,
	sandboxListSchema,
} from '#lib/features/sandboxes/lib/sandbox-list-schema.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

const FIRST_PAGE = 1;

export class SandboxesList {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(sandboxListSchema);
	readonly #listQuery = $derived(listSandboxesQuery(this.#params.current));
	readonly #listKey = $derived(JSON.stringify(this.#listQuery));
	readonly #lifecycleMutation = createMutation(() =>
		sandboxLifecycleMutationOptions()
	);
	readonly #bulkMutation = createMutation(() => sandboxBulkMutationOptions());
	readonly #deleteMutation = createMutation(() =>
		deleteSandboxMutationOptions()
	);

	readonly search = this.#params.text('search', { clears: ['cursor'] });
	readonly sandboxesQuery = createQuery(() =>
		sandboxListQueryOptions(this.#listQuery)
	);
	readonly snapshotsQuery = createQuery(() => allSnapshotsQueryOptions());
	readonly locationsQuery = createQuery(() => machineLocationsQueryOptions());
	readonly usageQuery = createQuery(() => organizationUsageQueryOptions());
	readonly limitsQuery = createQuery(() => organizationLimitsQueryOptions());

	readonly canWrite = $derived(this.#permission.can({ sandboxes: ['write'] }));
	readonly canDelete = $derived(
		this.#permission.can({ sandboxes: ['delete'] })
	);
	readonly sandboxes = $derived(this.sandboxesQuery.data?.items ?? []);
	selectedRowIds: string[] = $derived.by(() => {
		void this.#listKey;
		return [];
	});
	createOpen = $derived(Boolean(this.#params.current.machine) && this.canWrite);
	request = $state.raw<SandboxActionRequest | null>(null);

	readonly pinnedMachineId = $derived(this.#params.current.machine ?? null);
	readonly filterTags: ResourceFilterTag[] = $derived(
		sandboxFilterTags(this.#params.current).map((tag) => ({
			label: tag.label,
			onRemove: () => void this.#params.update(clearedSandboxParams(tag.keys)),
		}))
	);
	readonly appliedSearch = $derived(this.#params.current.search.trim());
	readonly narrowed = $derived(
		this.appliedSearch !== '' || this.filterTags.length > 0
	);
	readonly clearLabel = $derived.by(() => {
		if (this.appliedSearch && this.filterTags.length > 0)
			return 'Clear search and filters';
		return this.appliedSearch ? 'Clear search' : 'Clear filters';
	});
	readonly confirmPending = $derived(
		this.#bulkMutation.isPending || this.#deleteMutation.isPending
	);
	readonly sortConfig = $derived.by(
		(): ResourceSortConfig => ({
			options: SANDBOX_SORT_OPTIONS,
			active: {
				column: this.#params.current.sort,
				direction:
					this.#params.current.order === SandboxListSortDirection.Asc
						? 'asc'
						: 'desc',
			},
			onSort: this.#changeSort,
		})
	);
	readonly pagination = $derived.by((): CursorResourcePaginationConfig => {
		const cursors = this.#params.current.cursor;
		const nextCursor = this.sandboxesQuery.data?.nextCursor;
		return {
			mode: 'cursor',
			page: cursors.length + FIRST_PAGE,
			hasPrevious: cursors.length > 0,
			hasNext: Boolean(nextCursor),
			disabled: this.sandboxesQuery.isFetching,
			onPrevious: () =>
				void this.#params.update({ cursor: cursors.slice(0, -1) }),
			onNext: () => {
				if (nextCursor)
					void this.#params.update({ cursor: [...cursors, nextCursor] });
			},
		};
	});

	openCreate = (): void => {
		this.createOpen = true;
	};

	clearSearchAndFilters = (): void => {
		this.search.value = '';
		void this.search.flush();
		void this.#params.update(
			clearedSandboxParams(['search', ...SANDBOX_FILTER_KEYS])
		);
	};

	changeCreateOpen = (open: boolean): void => {
		if (!open && this.#params.current.machine)
			void this.#params.update({ machine: undefined });
	};

	requestDelete = (targets: SandboxActionRequest['targets']): void => {
		if (targets.length > 0) this.request = { action: 'delete', targets };
	};

	runAction = (
		action: SandboxLifecycleAction,
		targets: SandboxActionRequest['targets']
	): void => {
		const [sandbox] = targets;
		if (targets.length === 1 && sandbox) {
			this.#lifecycleMutation.mutate(
				{ sandbox, action },
				{
					onSuccess: () =>
						toast.success(`${SANDBOX_ACTION_COPY[action].label} requested`),
				}
			);
			return;
		}
		if (targets.length > 1) this.request = { action, targets };
	};

	confirmRequest = ({ action, targets }: SandboxActionRequest): void => {
		const [sandbox] = targets;
		if (action === 'delete' && targets.length === 1 && sandbox) {
			this.#deleteMutation.mutate(sandbox, {
				onSuccess: (deleted) => {
					this.request = null;
					this.selectedRowIds = [];
					toast.success(`Deleted ${deleted.name}`);
				},
			});
			return;
		}
		this.#bulkMutation.mutate(
			{ action, sandboxes: targets },
			{
				onSuccess: ({ failed, succeeded }) => {
					this.request = null;
					this.selectedRowIds = [];
					const message = bulkResultMessage(action, succeeded, failed);
					if (failed > 0) toast.error(message);
					else toast.success(message);
				},
			}
		);
	};

	#changeSort = (column: string, direction: ResourceSortDirection): void => {
		if (!isSandboxSortField(column)) return;
		void this.#params.update({
			sort: column,
			order:
				direction === 'asc'
					? SandboxListSortDirection.Asc
					: SandboxListSortDirection.Desc,
			cursor: undefined,
		});
	};
}
