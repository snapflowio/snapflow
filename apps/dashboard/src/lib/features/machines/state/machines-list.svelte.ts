/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Plus from '@lucide/svelte/icons/plus';
import type { HostMachine, Machine } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { allHostMachinesQueryOptions } from '#lib/api/listings.ts';
import {
	allMachinesQueryOptions,
	deleteMachineMutationOptions,
	organizationMachineOperations,
	revokeMachineIdentityMutationOptions,
	toggleMachineSchedulingMutationOptions,
	updateMachineDrainingMutationOptions,
} from '#lib/api/machines/machines.ts';
import { hostEscrowBalanceQueryOptions } from '#lib/api/settlement/escrow.ts';
import Trash from '#lib/components/icons/trash.svelte';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import type {
	ResourceFilterTag,
	ResourceSegment,
	ResourceSortConfig,
} from '#lib/components/resource/resource-options.ts';
import type { ResourceRefreshInterval } from '#lib/components/resource/resource-refresh.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	locationOptions,
	summarizeLocations,
} from '#lib/features/locations/lib/location-format.ts';
import {
	MACHINE_DELETE_REQUIRES_PAUSE,
	machineDeletable,
	machineWithdrawalMessage,
} from '#lib/features/machines/lib/machine-format.ts';
import {
	CLEARED_MACHINE_FILTERS,
	filterMachines,
	isMachineListView,
	isMachineSortColumn,
	MACHINE_SORT_OPTIONS,
	type MachineFilterPatch,
	type MachineListParams,
	type MachineListView,
	machineFilterTags,
	machineListSchema,
	machineListSegments,
} from '#lib/features/machines/lib/machine-list-params.ts';
import {
	type MachineActionHandlers,
	machineRowActions,
} from '#lib/features/machines/lib/machine-row-actions.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

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
	selectedIds = $state<string[]>([]);
	deleting = $state.raw<Machine | null>(null);
	bulkDeleting = $state.raw<readonly Machine[]>([]);
	revoking = $state.raw<Machine | null>(null);
	startingDrain = $state.raw<Machine | null>(null);

	readonly canWrite = $derived(this.#permission.can({ machines: ['write'] }));
	readonly canDelete = $derived(this.#permission.can({ machines: ['delete'] }));
	readonly #canReadListings = $derived(
		this.#permission.can({ listings: ['read'] })
	);
	readonly #canReadPayouts = $derived(
		this.#permission.can({ payouts: ['read'] })
	);

	readonly machinesQuery = createQuery(() => ({
		...allMachinesQueryOptions(),
		refetchInterval: this.refreshInterval,
	}));
	readonly #hostsQuery = createQuery(() => ({
		...allHostMachinesQueryOptions(),
		enabled: this.#canReadListings,
		refetchInterval: this.refreshInterval,
	}));
	readonly #earningsQuery = createQuery(() => ({
		...hostEscrowBalanceQueryOptions(),
		enabled: this.#canReadPayouts,
	}));

	readonly params: MachineListParams = $derived(this.#params.current);
	readonly #allMachines: readonly Machine[] = $derived(
		this.machinesQuery.data ?? []
	);
	readonly hostsById: ReadonlyMap<string, HostMachine> = $derived(
		new Map((this.#hostsQuery.data ?? []).map((host) => [host.machineId, host]))
	);
	readonly earnedById: ReadonlyMap<string, string> = $derived.by(() => {
		const totals = new Map<string, bigint>();
		for (const machine of this.#earningsQuery.data?.machines ?? []) {
			const earned =
				BigInt(machine.pendingMicroUsd) + BigInt(machine.withdrawnMicroUsd);
			totals.set(
				machine.machineId,
				(totals.get(machine.machineId) ?? 0n) + earned
			);
		}
		return new Map(
			[...totals].map(([machineId, total]) => [machineId, total.toString()])
		);
	});
	readonly showsListing = $derived(this.#canReadListings);
	readonly showsEarnings = $derived(this.#canReadPayouts);
	readonly locationFilterOptions = $derived.by(() =>
		locationOptions(
			summarizeLocations(this.#allMachines.map((machine) => machine.location))
		)
	);
	readonly #machinesById = $derived.by(
		() => new Map(this.#allMachines.map((machine) => [machine.id, machine]))
	);
	readonly segments: ResourceSegment<MachineListView>[] = $derived(
		machineListSegments(this.#allMachines)
	);
	readonly filterTags: ResourceFilterTag[] = $derived.by(() =>
		machineFilterTags(this.#params.current).map((tag) => ({
			field: tag.field,
			value: tag.value,
			onRemove: () =>
				void this.#params.update({
					[tag.key]: CLEARED_MACHINE_FILTERS[tag.key],
				}),
		}))
	);
	readonly machines: Machine[] = $derived.by(() =>
		filterMachines(
			this.#allMachines,
			{ ...this.#params.current, search: this.search.value },
			this.hostsById
		)
	);
	readonly hasQuery = $derived(
		this.search.value.trim().length > 0 || this.filterTags.length > 0
	);
	readonly hasMachines = $derived(this.#allMachines.length > 0);
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
	contextActions = (rowId: string | null): ResourceRowAction[] => {
		const target = rowId ? this.#machinesById.get(rowId) : undefined;
		if (
			target &&
			this.selectedIds.length > 1 &&
			this.selectedIds.includes(target.id)
		) {
			return [
				{
					icon: Trash,
					label: `Delete ${this.selectedIds.length} machines`,
					destructive: true,
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
	};
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
		void goto(resolve(Path.MACHINES_ADD));
	};

	rowActions = (machine: Machine): ResourceRowAction[] =>
		machineRowActions(machine, this.handlers);

	openMachine = (machineId: string): void => {
		void goto(
			resolve('/(app)/(dashboard)/machines/[machineId]', { machineId })
		);
	};

	openHealth = (machine: Machine): void => {
		void goto(
			resolve('/(app)/(dashboard)/machines/[machineId]/health', {
				machineId: machine.id,
			})
		);
	};

	retarget = (_event: MouseEvent, machineId: string): void => {
		if (this.selectedIds.length > 0 && !this.selectedIds.includes(machineId)) {
			this.selectedIds = [machineId];
		}
	};

	setView = (view: string): void => {
		if (isMachineListView(view)) void this.#params.update({ view });
	};

	updateFilters = (patch: MachineFilterPatch): void => {
		void this.#params.update(patch);
	};

	clearFilters = (): void => {
		void this.#params.update(CLEARED_MACHINE_FILTERS);
	};

	clearQuery = (): void => {
		this.search.value = '';
		void this.#params.update({ search: '', ...CLEARED_MACHINE_FILTERS });
	};

	requestBulkDelete = (ids: readonly string[]): void => {
		const selected = ids.flatMap((id) => this.#machinesById.get(id) ?? []);
		const targets = selected.filter(machineDeletable);
		if (targets.length < selected.length)
			toast.info(MACHINE_DELETE_REQUIRES_PAUSE);
		if (targets.length === 1) this.deleting = targets[0] ?? null;
		else this.bulkDeleting = targets;
	};

	setDraining = (machine: Machine, draining: boolean): void => {
		this.drainingMutation.mutate(
			{ draining, machine },
			{
				onSuccess: () => {
					this.startingDrain = null;
					toast.success(machineWithdrawalMessage(draining));
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
