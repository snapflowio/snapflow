/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type SandboxListItem,
	SandboxListSortDirection,
} from '@snapflow/api-client';
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
import type {
	SandboxActionRequest,
	SandboxActionTarget,
} from '#lib/features/sandboxes/components/sandbox-action-confirm-modal.svelte';
import {
	bulkFailureMessage,
	bulkResultMessage,
	CONFIRMED_LIFECYCLE_ACTIONS,
	SANDBOX_ACTION_COPY,
} from '#lib/features/sandboxes/lib/sandbox-list-actions.ts';
import {
	clearedSandboxParams,
	isSandboxSortField,
	isSandboxView,
	listSandboxesQuery,
	SANDBOX_FILTER_KEYS,
	SANDBOX_SORT_OPTIONS,
	SANDBOX_VIEW_SEGMENTS,
	SandboxView,
	sandboxFilterTags,
	sandboxListSchema,
} from '#lib/features/sandboxes/lib/sandbox-list-schema.ts';
import { SANDBOX_WRITE_PERMISSION_REASON } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { SandboxStartFlow } from '#lib/features/sandboxes/state/sandbox-start-flow.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const FIRST_PAGE = 1;
const CREATE_LABEL = 'New sandbox';
const LIMITS_LOADING_REASON = 'Loading limits';
const LIMITS_UNAVAILABLE_REASON = "Limits couldn't load";
const LIMITS_FAILED_MESSAGE = "Organization limits couldn't load";

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
	#reportedLimitsError = 0;

	readonly search = this.#params.text('search', { clears: ['cursor'] });
	readonly sandboxesQuery = createQuery(() =>
		sandboxListQueryOptions(this.#listQuery)
	);
	readonly snapshotsQuery = createQuery(() => allSnapshotsQueryOptions());
	readonly locationsQuery = createQuery(() => machineLocationsQueryOptions());
	readonly usageQuery = createQuery(() => organizationUsageQueryOptions());
	readonly limitsQuery = createQuery(() => organizationLimitsQueryOptions());
	readonly startFlow = new SandboxStartFlow();
	readonly segments = SANDBOX_VIEW_SEGMENTS;
	readonly createLabel = CREATE_LABEL;

	readonly canWrite = $derived(this.#permission.can({ sandboxes: ['write'] }));
	readonly canDelete = $derived(
		this.#permission.can({ sandboxes: ['delete'] })
	);
	readonly view = $derived(this.#params.current.view);
	acknowledgedIds: ReadonlySet<string> | null = $derived.by(() => {
		void this.#listKey;
		return null;
	});
	readonly #items = $derived(this.sandboxesQuery.data?.items ?? []);
	readonly sandboxes: readonly SandboxListItem[] = $derived.by(() => {
		const known = this.acknowledgedIds;
		return known
			? this.#items.filter((item) => known.has(item.id))
			: this.#items;
	});
	readonly newCount = $derived(this.#items.length - this.sandboxes.length);
	selectedRowIds: string[] = $derived.by(() => {
		void this.#listKey;
		return [];
	});
	createOpen = $derived(
		Boolean(this.#params.current.machine || this.#params.current.create) &&
			this.canWrite
	);
	readonly createDisabledReason = $derived.by(() => {
		if (!this.canWrite) return SANDBOX_WRITE_PERMISSION_REASON;
		if (this.limitsQuery.isError) return LIMITS_UNAVAILABLE_REASON;
		return this.limitsQuery.isPending ? LIMITS_LOADING_REASON : null;
	});
	request = $state.raw<SandboxActionRequest | null>(null);

	readonly pinnedMachineId = $derived(this.#params.current.machine ?? null);
	readonly presetSnapshot = $derived(this.#params.current.preset ?? null);
	readonly filterTags: ResourceFilterTag[] = $derived(
		sandboxFilterTags(this.#params.current).map((tag) => ({
			field: tag.field,
			value: tag.value,
			onRemove: () => void this.#params.update(clearedSandboxParams(tag.keys)),
		}))
	);
	readonly appliedSearch = $derived(this.#params.current.search.trim());
	readonly narrowed = $derived(
		this.appliedSearch !== '' ||
			this.filterTags.length > 0 ||
			this.view !== SandboxView.All
	);
	readonly narrowingCount = $derived(
		this.filterTags.length + (this.view === SandboxView.All ? 0 : 1)
	);
	readonly narrowingTags: ResourceFilterTag[] = $derived.by(() => {
		const segment = this.segments.find((item) => item.value === this.view);
		if (this.view === SandboxView.All || !segment) return this.filterTags;
		return [
			{
				field: 'View',
				value: segment.label,
				onRemove: () => this.changeView(SandboxView.All),
			},
			...this.filterTags,
		];
	});
	readonly confirmPending = $derived(
		this.#bulkMutation.isPending ||
			this.#deleteMutation.isPending ||
			this.#lifecycleMutation.isPending
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

	constructor() {
		$effect(() => {
			if (
				this.acknowledgedIds !== null ||
				!this.sandboxesQuery.isSuccess ||
				this.sandboxesQuery.isPlaceholderData
			) {
				return;
			}
			this.acknowledgedIds = new Set(this.#items.map((item) => item.id));
		});
		$effect(() => {
			const failedAt = this.limitsQuery.errorUpdatedAt;
			if (
				!(this.canWrite && this.limitsQuery.isError) ||
				failedAt === this.#reportedLimitsError
			) {
				return;
			}
			this.#reportedLimitsError = failedAt;
			toast.error(LIMITS_FAILED_MESSAGE, {
				action: { label: 'Retry', onClick: this.retryLimits },
			});
		});
	}

	showNew = (): void => {
		this.acknowledgedIds = new Set(this.#items.map((item) => item.id));
	};

	changeView = (value: string): void => {
		if (!isSandboxView(value)) return;
		void this.#params.update({
			view: value === SandboxView.All ? undefined : value,
			state: undefined,
			cursor: undefined,
		});
	};

	openCreate = (): void => {
		if (this.createDisabledReason === null) this.createOpen = true;
	};

	openTerminal = (sandbox: SandboxActionTarget): void => {
		void goto(
			resolve('/(app)/(dashboard)/sandboxes/[sandboxId]/terminal', {
				sandboxId: sandbox.id,
			})
		);
	};

	retryLimits = (): void => {
		void this.limitsQuery.refetch();
	};

	clearSearchAndFilters = (): void => {
		this.search.value = '';
		void this.search.flush();
		void this.#params.update(
			clearedSandboxParams(['search', 'view', ...SANDBOX_FILTER_KEYS])
		);
	};

	changeCreateOpen = (open: boolean): void => {
		const { create, machine, preset } = this.#params.current;
		if (!open && (machine || create || preset))
			void this.#params.update({
				machine: undefined,
				create: undefined,
				preset: undefined,
			});
	};

	requestDelete = (targets: SandboxActionRequest['targets']): void => {
		if (targets.length > 0) this.request = { action: 'delete', targets };
	};

	runAction = (
		action: SandboxLifecycleAction,
		targets: SandboxActionRequest['targets']
	): void => {
		const [sandbox] = targets;
		const confirmed = CONFIRMED_LIFECYCLE_ACTIONS.has(action);
		if (targets.length === 1 && sandbox && action === 'start') {
			this.startFlow.start(sandbox.id);
		} else if (targets.length === 1 && sandbox && !confirmed) {
			this.#runSingle(action, sandbox);
		} else if (targets.length > 0) {
			this.request = { action, targets };
		}
	};

	confirmRequest = ({ action, targets }: SandboxActionRequest): void => {
		const [sandbox] = targets;
		if (action !== 'delete' && targets.length === 1 && sandbox) {
			this.#runSingle(action, sandbox, () => {
				this.request = null;
			});
			return;
		}
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
				onSuccess: ({ failed, succeeded, failedTargets }) => {
					this.request = null;
					this.selectedRowIds = failedTargets.map((target) => target.id);
					if (failed === 0) {
						toast.success(bulkResultMessage(action, succeeded));
						return;
					}
					toast.error(bulkFailureMessage(failed, targets.length), {
						action: {
							label: 'Retry',
							onClick: () => {
								this.request = { action, targets: failedTargets };
							},
						},
					});
				},
			}
		);
	};

	#runSingle(
		action: SandboxLifecycleAction,
		sandbox: SandboxActionTarget,
		onDone?: () => void
	): void {
		this.#lifecycleMutation.mutate(
			{ sandbox, action },
			{
				onSuccess: () => {
					onDone?.();
					toast.success(`${SANDBOX_ACTION_COPY[action].label} requested`);
				},
			}
		);
	}

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
