/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Plus from '@lucide/svelte/icons/plus';
import type { Machine } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	allMachinesQueryOptions,
	deleteMachineMutationOptions,
	organizationMachineOperations,
	revokeMachineIdentityMutationOptions,
	toggleMachineSchedulingMutationOptions,
	updateMachineDrainingMutationOptions,
} from '#lib/api/machines.ts';
import Trash from '#lib/components/icons/trash.svelte';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import type {
	ResourceFilterTag,
	ResourceSortConfig,
} from '#lib/components/resource/resource-options.ts';
import type { ResourceRefreshInterval } from '#lib/components/resource/resource-refresh.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	locationOptions,
	summarizeLocations,
} from '#lib/features/locations/lib/location-format.ts';
import { machineDrainingMessage } from '#lib/features/machines/lib/machine-format.ts';
import {
	filterMachines,
	isMachineSortColumn,
	MACHINE_SORT_OPTIONS,
	type MachineListParams,
	machineFilterTags,
	machineListSchema,
} from '#lib/features/machines/lib/machine-list-params.ts';
import {
	type MachineActionHandlers,
	machineRowActions,
} from '#lib/features/machines/lib/machine-row-actions.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

type MachineFilterPatch = Partial<
	Pick<MachineListParams, 'state' | 'location' | 'scheduling'>
>;

export class MachinesList {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(machineListSchema);
	readonly #schedulingMutation = createMutation(() =>
		toggleMachineSchedulingMutationOptions(organizationMachineOperations)
	);

	readonly search = this.#params.text('search');
	readonly drainingMutation = createMutation(() =>
		updateMachineDrainingMutationOptions(organizationMachineOperations)
	);
	readonly deleteMutation = createMutation(() =>
		deleteMachineMutationOptions(organizationMachineOperations)
	);
	readonly revokeMutation = createMutation(() =>
		revokeMachineIdentityMutationOptions()
	);

	refreshInterval = $state<ResourceRefreshInterval>(false);
	addOpen = $state(false);
	selectedIds = $state<string[]>([]);
	contextId = $state<string | null>(null);
	deleting = $state.raw<Machine | null>(null);
	bulkDeleting = $state.raw<readonly Machine[]>([]);
	revoking = $state.raw<Machine | null>(null);
	startingDrain = $state.raw<Machine | null>(null);

	readonly machinesQuery = createQuery(() => ({
		...allMachinesQueryOptions(),
		refetchInterval: this.refreshInterval,
	}));

	readonly canWrite = $derived(this.#permission.can({ machines: ['write'] }));
	readonly canDelete = $derived(this.#permission.can({ machines: ['delete'] }));
	readonly params: MachineListParams = $derived(this.#params.current);
	readonly #allMachines: readonly Machine[] = $derived(
		this.machinesQuery.data ?? []
	);
	readonly locationFilterOptions = $derived.by(() =>
		locationOptions(
			summarizeLocations(this.#allMachines.map((machine) => machine.location))
		)
	);
	readonly #machinesById = $derived.by(
		() => new Map(this.#allMachines.map((machine) => [machine.id, machine]))
	);
	readonly filterTags: ResourceFilterTag[] = $derived.by(() =>
		machineFilterTags(this.#params.current).map((tag) => ({
			label: tag.label,
			onRemove: () => void this.#params.update({ [tag.key]: [] }),
		}))
	);
	readonly machines: Machine[] = $derived.by(() =>
		filterMachines(this.#allMachines, {
			...this.#params.current,
			search: this.search.value,
		})
	);
	readonly hasQuery = $derived(
		this.search.value.trim().length > 0 || this.filterTags.length > 0
	);
	readonly sort = $derived(
		this.#params.current.sort
			? {
					column: this.#params.current.sort,
					direction: this.#params.current.dir,
				}
			: undefined
	);
	readonly sortConfig: ResourceSortConfig = $derived.by(() => ({
		options: MACHINE_SORT_OPTIONS,
		active: this.sort ?? null,
		onSort: (column, dir) => {
			if (isMachineSortColumn(column))
				void this.#params.update({ sort: column, dir });
		},
		onClear: () => void this.#params.update({ sort: null, dir: 'desc' }),
	}));
	readonly handlers: MachineActionHandlers = $derived.by(() => ({
		onOpen: (target: Machine) => this.openMachine(target.id),
		onToggleScheduling: this.canWrite
			? (target: Machine) => this.#schedulingMutation.mutate(target)
			: undefined,
		onDrainingChange: this.canWrite ? this.requestDrainingChange : undefined,
		onRevokeIdentity: this.canDelete
			? (target: Machine) => {
					this.revoking = target;
				}
			: undefined,
		onDelete: this.canDelete
			? (target: Machine) => {
					this.deleting = target;
				}
			: undefined,
	}));
	readonly contextActions: ResourceRowAction[] = $derived.by(() => {
		const target = this.contextId
			? this.#machinesById.get(this.contextId)
			: undefined;
		if (
			target &&
			this.selectedIds.length > 1 &&
			this.selectedIds.includes(target.id)
		) {
			return [
				{
					icon: Trash,
					label: `Delete ${this.selectedIds.length} machines`,
					onSelect: () => this.requestBulkDelete(this.selectedIds),
					visible: this.canDelete,
				},
			];
		}
		if (target) return this.rowActions(target);
		return [
			{
				icon: Plus,
				label: 'Add machine',
				onSelect: this.openAdd,
				visible: this.canWrite,
			},
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
						onSelect: this.requestBulkDelete,
					},
				]
			: []
	);

	openAdd = (): void => {
		this.addOpen = true;
	};

	rowActions = (machine: Machine): ResourceRowAction[] =>
		machineRowActions(machine, this.handlers);

	openMachine = (machineId: string): void => {
		void goto(
			resolve('/(app)/(dashboard)/machines/[machineId]', { machineId })
		);
	};

	retarget = (_event: MouseEvent, machineId: string): void => {
		this.contextId = machineId;
		if (this.selectedIds.length > 0 && !this.selectedIds.includes(machineId)) {
			this.selectedIds = [machineId];
		}
	};

	clearContext = (): void => {
		this.contextId = null;
	};

	updateFilters = (patch: MachineFilterPatch): void => {
		void this.#params.update(patch);
	};

	clearFilters = (): void => {
		void this.#params.update({ state: [], location: [], scheduling: [] });
	};

	clearQuery = (): void => {
		this.search.value = '';
		void this.#params.update({
			search: '',
			state: [],
			location: [],
			scheduling: [],
		});
	};

	requestBulkDelete = (ids: readonly string[]): void => {
		const targets = ids.flatMap((id) => this.#machinesById.get(id) ?? []);
		if (targets.length === 1) this.deleting = targets[0] ?? null;
		else this.bulkDeleting = targets;
	};

	setDraining = (machine: Machine, draining: boolean): void => {
		this.drainingMutation.mutate(
			{ draining, machine },
			{
				onSuccess: () => {
					this.startingDrain = null;
					toast.success(machineDrainingMessage(draining));
				},
			}
		);
	};

	requestDrainingChange = (machine: Machine): void => {
		if (machine.draining) this.setDraining(machine, false);
		else this.startingDrain = machine;
	};

	deleteMachines = async (targets: readonly Machine[]): Promise<void> => {
		await Promise.allSettled(
			targets.map((machine) => this.deleteMutation.mutateAsync(machine))
		);
		this.selectedIds = this.selectedIds.filter(
			(id) => !targets.some((machine) => machine.id === id)
		);
		this.deleting = null;
		this.bulkDeleting = [];
	};

	revokeIdentity = (machine: Machine): void => {
		this.revokeMutation.mutate(machine, {
			onSuccess: () => {
				this.revoking = null;
			},
		});
	};
}
