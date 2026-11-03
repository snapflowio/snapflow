/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import Pause from '@lucide/svelte/icons/pause';
import Play from '@lucide/svelte/icons/play';
import PowerOff from '@lucide/svelte/icons/power-off';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import Trash from '@lucide/svelte/icons/trash-2';
import { type Machine, MachineState } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	adminAllMachinesQueryOptions,
	adminMachineOperations,
	deleteMachineMutationOptions,
	toggleMachineSchedulingMutationOptions,
	updateMachineDrainingMutationOptions,
} from '#lib/api/machines.ts';
import type { ResourceRefreshInterval } from '#lib/components/resource/resource-refresh.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	adminFilter,
	adminFilterOptions,
} from '#lib/features/admin/lib/admin-filters.ts';
import {
	copyId,
	matchesFilter,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import {
	MACHINE_FILTER_KEYS,
	MACHINE_SCHEDULING_LABELS,
	MACHINE_SORT_OPTIONS,
	MACHINE_STATE_OPTIONS,
	machinesSearchSchema,
} from '#lib/features/admin/lib/machines-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import {
	locationLabel,
	locationOptions,
	matchesLocation,
	summarizeLocations,
} from '#lib/features/locations/lib/location-format.ts';
import {
	machineDrainingActionLabel,
	machineDrainingMessage,
	machineSchedulingActionLabel,
} from '#lib/features/machines/lib/machine-format.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class AdminMachinesList {
	readonly #params = new SearchParams(machinesSearchSchema);
	readonly #schedulingMutation = createMutation(() =>
		toggleMachineSchedulingMutationOptions(adminMachineOperations)
	);

	readonly controls = new AdminListControls(this.#params, {
		sortOptions: MACHINE_SORT_OPTIONS,
		filterKeys: MACHINE_FILTER_KEYS,
		filterFields: () => [
			adminFilter({
				id: 'state',
				label: 'State',
				options: MACHINE_STATE_OPTIONS,
				values: this.#params.current.state,
				onChange: (state) => void this.#params.update({ state }),
			}),
			adminFilter({
				id: 'location',
				label: 'Location',
				options: this.#locationFilterOptions,
				values: this.#params.current.location,
				onChange: (location) => void this.#params.update({ location }),
			}),
			adminFilter({
				id: 'scheduling',
				label: 'Scheduling',
				options: adminFilterOptions(MACHINE_SCHEDULING_LABELS),
				values: this.#params.current.scheduling,
				onChange: (scheduling) => void this.#params.update({ scheduling }),
			}),
		],
	});

	refreshInterval = $state<ResourceRefreshInterval>(false);
	decommissioning = $state.raw<Machine | null>(null);
	deleting = $state.raw<Machine | null>(null);

	readonly machinesQuery = createQuery(() => ({
		...adminAllMachinesQueryOptions(),
		refetchInterval: this.refreshInterval,
	}));
	readonly drainingMutation = createMutation(() =>
		updateMachineDrainingMutationOptions(adminMachineOperations)
	);
	readonly deleteMutation = createMutation(() =>
		deleteMachineMutationOptions(adminMachineOperations)
	);

	readonly #allMachines: readonly Machine[] = $derived.by(
		() => this.machinesQuery.data ?? []
	);
	readonly #machinesById = $derived.by(
		() => new Map(this.#allMachines.map((machine) => [machine.id, machine]))
	);
	readonly #locationFilterOptions = $derived.by(() =>
		locationOptions(
			summarizeLocations(this.#allMachines.map((machine) => machine.location))
		)
	);
	readonly machines: readonly Machine[] = $derived.by(() =>
		this.#allMachines.filter(
			(machine) =>
				matchesSearch(this.controls.search.value, [
					machine.id,
					machine.name,
					locationLabel(machine.location),
				]) &&
				matchesFilter(this.#params.current.state, machine.state) &&
				matchesLocation(machine.location, this.#params.current.location) &&
				matchesFilter(
					this.#params.current.scheduling,
					machine.unschedulable ? 'paused' : 'available'
				)
		)
	);

	machineActions = (machine: Machine): ResourceRowAction[] => {
		const lifecycle = machine.state !== MachineState.Decommissioned;
		return [
			{
				icon: machine.unschedulable ? Play : Pause,
				label: machineSchedulingActionLabel(machine),
				onSelect: () => this.#schedulingMutation.mutate(machine),
				visible: lifecycle,
			},
			{
				icon: machine.draining ? RotateCcw : PowerOff,
				label: machineDrainingActionLabel(machine),
				onSelect: () => {
					if (machine.draining) this.setDraining(machine, false);
					else this.decommissioning = machine;
				},
				visible: lifecycle,
			},
			{ icon: Copy, label: 'Copy ID', onSelect: () => copyId(machine.id) },
			{
				icon: Trash,
				label: 'Delete',
				onSelect: () => {
					this.deleting = machine;
				},
				separated: true,
			},
		];
	};

	machineRowActions = (machineId: string): ResourceRowAction[] => {
		const machine = this.#machinesById.get(machineId);
		return machine ? this.machineActions(machine) : [];
	};

	setRefreshInterval = (interval: ResourceRefreshInterval): void => {
		this.refreshInterval = interval;
	};

	setDraining = (machine: Machine, draining: boolean): void => {
		this.drainingMutation.mutate(
			{ draining, machine },
			{
				onSuccess: () => {
					this.decommissioning = null;
					toast.success(machineDrainingMessage(draining));
				},
			}
		);
	};

	decommission = (machine: Machine): void => {
		this.setDraining(machine, true);
	};

	cancelDecommission = (): void => {
		this.decommissioning = null;
	};

	cancelDelete = (): void => {
		this.deleting = null;
	};

	confirmDelete = (machine: Machine): void => {
		this.deleteMutation.mutate(machine, {
			onSuccess: () => {
				this.deleting = null;
			},
		});
	};
}
