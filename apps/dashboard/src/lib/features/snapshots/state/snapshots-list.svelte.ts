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
import ScrollText from '@lucide/svelte/icons/scroll-text';
import Square from '@lucide/svelte/icons/square';
import {
	type CreateSnapshot,
	type SnapshotDto,
	SnapshotState,
} from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { idempotencyHeaders } from '#lib/api/client/api-client.ts';
import {
	organizationLimitsQueryOptions,
	organizationUsageQueryOptions,
} from '#lib/api/organizations/limits.ts';
import {
	allSnapshotsQueryOptions,
	bulkRemoveSnapshotsMutationOptions,
	bulkSnapshotStateMutationOptions,
	createSnapshotMutationOptions,
	openSnapshotBuildLogs,
	removeSnapshotMutationOptions,
	type SnapshotSettledCounts,
	type SnapshotStateAction,
	snapshotStateMutationOptions,
} from '#lib/api/snapshots.ts';
import Play from '#lib/components/icons/play.svelte';
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
	isSnapshotState,
	matchesSnapshot,
	SNAPSHOT_SORT_ACCESSORS,
	SNAPSHOT_SORT_OPTIONS,
	snapshotsSearchSchema,
} from '#lib/features/snapshots/lib/snapshots-list.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { pluralize, sentenceCase } from '#lib/utils/text.ts';

function toastBulkResult(
	{ failed, succeeded }: SnapshotSettledCounts,
	outcome: string
): void {
	const message = `${pluralize(succeeded, 'snapshot')} ${outcome}`;
	if (failed > 0) toast.error(`${message}; ${failed} failed`);
	else toast.success(message);
}

export class SnapshotsList {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(snapshotsSearchSchema);
	readonly #clipboard = new CopyToClipboard();
	readonly #createSnapshot = createMutation(() =>
		createSnapshotMutationOptions()
	);
	readonly #stateMutation = createMutation(() =>
		snapshotStateMutationOptions()
	);
	readonly #bulkStateMutation = createMutation(() =>
		bulkSnapshotStateMutationOptions()
	);
	#lastOpened: SnapshotDto | null = null;

	readonly search = this.#params.text('search');
	readonly snapshotsQuery = createQuery(() => allSnapshotsQueryOptions());
	readonly usageQuery = createQuery(() => organizationUsageQueryOptions());
	readonly limitsQuery = createQuery(() => organizationLimitsQueryOptions());
	readonly deleteMutation = createMutation(() =>
		removeSnapshotMutationOptions()
	);
	readonly bulkDeleteMutation = createMutation(() =>
		bulkRemoveSnapshotsMutationOptions()
	);

	createOpen = $state(false);
	bulkDeleteOpen = $state(false);
	deleting = $state.raw<SnapshotDto | null>(null);

	readonly canWrite = $derived(this.#permission.can({ snapshots: ['write'] }));
	readonly canDelete = $derived(
		this.#permission.can({ snapshots: ['delete'] })
	);
	readonly states = $derived(this.#params.current.state);
	readonly #sort = $derived(
		activeSort(this.#params.current.sort, this.#params.current.dir)
	);
	readonly snapshots: readonly SnapshotDto[] = $derived.by(() => {
		const query = this.search.value.trim().toLowerCase();
		const filtered = (this.snapshotsQuery.data ?? []).filter((snapshot) =>
			matchesSnapshot(snapshot, query, this.states)
		);
		return sortRows(filtered, this.#sort, SNAPSHOT_SORT_ACCESSORS);
	});
	readonly selection = new ResourceSelection(
		() => this.snapshots,
		(snapshot) => snapshot.id,
		(snapshot) => !snapshot.general
	);
	readonly panel = new OpenRowParam(
		() => this.snapshots,
		(snapshot) => snapshot.id,
		{ pushOnSwitch: true }
	);
	readonly #selectedActive = $derived(
		this.selection.selected.filter(
			(snapshot) => snapshot.state === SnapshotState.Active
		)
	);
	readonly #selectedInactive = $derived(
		this.selection.selected.filter(
			(snapshot) => snapshot.state === SnapshotState.Inactive
		)
	);
	readonly panelSnapshot: SnapshotDto | null = $derived.by(() => {
		if (this.panel.row) this.#lastOpened = this.panel.row;
		return this.panel.row ?? this.#lastOpened;
	});
	readonly bulkDeleteTarget: readonly SnapshotDto[] | null = $derived(
		this.bulkDeleteOpen ? this.selection.selected : null
	);
	readonly sortConfig: ResourceSortConfig = $derived(
		resourceListSortConfig(
			SNAPSHOT_SORT_OPTIONS,
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
	readonly bulkActions: ResourceBulkAction[] = $derived.by(() => [
		...(this.canWrite
			? [
					{
						id: 'activate',
						label: 'Activate',
						icon: Play,
						disabled: this.#selectedInactive.length === 0,
						onSelect: () => this.#changeSelectedState('activate'),
					},
					{
						id: 'deactivate',
						label: 'Deactivate',
						icon: Square,
						disabled: this.#selectedActive.length === 0,
						onSelect: () => this.#changeSelectedState('deactivate'),
					},
				]
			: []),
		...(this.canDelete
			? [
					{
						id: 'delete',
						label: 'Delete',
						icon: Trash,
						destructive: true,
						disabled: this.selection.selected.length === 0,
						onSelect: this.confirmBulkDelete,
					},
				]
			: []),
	]);

	openCreate = (): void => {
		this.createOpen = true;
	};

	setStates = (values: readonly string[]): void => {
		void this.#params.update({ state: values.filter(isSnapshotState) });
	};

	clearSearchAndFilters = (): void => {
		this.search.value = '';
		void this.#params.update({ search: '', state: [] });
	};

	confirmBulkDelete = (): void => {
		if (this.selection.selected.length > 0) this.bulkDeleteOpen = true;
	};

	create = async (body: CreateSnapshot): Promise<void> => {
		await this.#createSnapshot.mutateAsync({
			body,
			headers: idempotencyHeaders(),
		});
		this.createOpen = false;
	};

	remove = (snapshot: SnapshotDto): void => {
		this.deleteMutation.mutate(snapshot, {
			onSuccess: (removed) => {
				this.deleting = null;
				if (this.panel.openId === removed.id) this.panel.close();
				toast.success(`Deleting ${removed.name}`);
			},
		});
	};

	removeSelected = (): void => {
		this.bulkDeleteMutation.mutate(this.selection.selected, {
			onSuccess: (counts) => {
				this.selection.clear();
				this.bulkDeleteOpen = false;
				toastBulkResult(counts, 'deleted');
			},
		});
	};

	rowActions = (snapshot: SnapshotDto): ResourceRowAction[] => [
		{
			icon: Play,
			label: 'Activate',
			onSelect: () => this.#changeState('activate', snapshot),
			visible: this.canWrite && snapshot.state === SnapshotState.Inactive,
		},
		{
			icon: Square,
			label: 'Deactivate',
			onSelect: () => this.#changeState('deactivate', snapshot),
			visible: this.canWrite && snapshot.state === SnapshotState.Active,
		},
		{
			icon: ScrollText,
			label: 'Build logs',
			onSelect: () => void openSnapshotBuildLogs(snapshot),
			visible: Boolean(snapshot.buildInfo),
		},
		{
			icon: Copy,
			label: 'Copy ID',
			onSelect: () => void this.#clipboard.copy(snapshot.id),
		},
		{
			icon: Trash,
			label: 'Delete',
			onSelect: () => {
				this.deleting = snapshot;
			},
			separated: true,
			visible: this.canDelete && !snapshot.general,
		},
	];

	contextActions = (rowId: string | null): ResourceRowAction[] =>
		this.selection.contextActions(rowId, {
			empty: () => [
				{
					icon: Plus,
					label: 'New snapshot',
					onSelect: this.openCreate,
					visible: this.canWrite,
				},
			],
			selection: () => this.#selectionActions(),
			row: this.rowActions,
		});

	#selectionActions(): ResourceRowAction[] {
		return [
			{
				icon: Play,
				label: `Activate ${pluralize(this.#selectedInactive.length, 'snapshot')}`,
				onSelect: () => this.#changeSelectedState('activate'),
				visible: this.canWrite && this.#selectedInactive.length > 0,
			},
			{
				icon: Square,
				label: `Deactivate ${pluralize(this.#selectedActive.length, 'snapshot')}`,
				onSelect: () => this.#changeSelectedState('deactivate'),
				visible: this.canWrite && this.#selectedActive.length > 0,
			},
			{
				icon: Trash,
				label: `Delete ${pluralize(this.selection.selected.length, 'snapshot')}`,
				onSelect: this.confirmBulkDelete,
				separated: true,
				visible: this.canDelete && this.selection.selected.length > 0,
			},
		];
	}

	#changeState(action: SnapshotStateAction, snapshot: SnapshotDto): void {
		this.#stateMutation.mutate(
			{ action, snapshot },
			{
				onSuccess: (requested) =>
					toast.success(`Snapshot ${requested} requested`),
			}
		);
	}

	#changeSelectedState(action: SnapshotStateAction): void {
		const targets =
			action === 'activate' ? this.#selectedInactive : this.#selectedActive;
		if (targets.length === 0) return;
		this.#bulkStateMutation.mutate(
			{ action, snapshots: targets },
			{
				onSuccess: ({ action: requested, counts }) => {
					this.selection.clear();
					toastBulkResult(counts, `${requested}d`);
				},
			}
		);
	}
}
