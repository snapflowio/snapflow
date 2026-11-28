/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Ban from '@lucide/svelte/icons/ban';
import Copy from '@lucide/svelte/icons/copy';
import Pause from '@lucide/svelte/icons/pause';
import PowerOff from '@lucide/svelte/icons/power-off';
import {
	type HostMachine,
	type Machine,
	MachineState,
} from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { createContext } from 'svelte';
import { allHostMachinesQueryOptions } from '#lib/api/listings.ts';
import { ispComplaintsQueryOptions } from '#lib/api/machines/isp-complaints.ts';
import {
	deleteMachineMutationOptions,
	machineQueryOptions,
	machineTrustQueryOptions,
	organizationMachineOperations,
	revokeMachineIdentityMutationOptions,
	toggleMachineSchedulingMutationOptions,
	updateMachineDrainingMutationOptions,
} from '#lib/api/machines/machines.ts';
import Play from '#lib/components/icons/play.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { copyWithToast } from '#lib/components/ui/clipboard/copy-with-toast.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	MACHINE_DELETE_REQUIRES_PAUSE,
	machineDeletable,
	machineSchedulingActionLabel,
	machineWithdrawalMessage,
} from '#lib/features/machines/lib/machine-format.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

type MachineConfirm = 'delete' | 'drain' | 'revoke';

const MACHINE_ID_LABEL = 'machine ID';

export class MachineDetail {
	readonly query;
	readonly trust;
	readonly complaints;
	readonly #permission = getOrganizationPermission();
	readonly #scheduling = createMutation(() =>
		toggleMachineSchedulingMutationOptions(organizationMachineOperations)
	);
	readonly draining = createMutation(() =>
		updateMachineDrainingMutationOptions(organizationMachineOperations)
	);
	readonly remove = createMutation(() =>
		deleteMachineMutationOptions(organizationMachineOperations)
	);
	readonly revoke = createMutation(() =>
		revokeMachineIdentityMutationOptions()
	);
	readonly canWrite = $derived(this.#permission.can({ machines: ['write'] }));
	readonly canDelete = $derived(this.#permission.can({ machines: ['delete'] }));
	readonly canReadListings = $derived(
		this.#permission.can({ listings: ['read'] })
	);
	readonly canWriteListings = $derived(
		this.#permission.can({ listings: ['write'] })
	);
	readonly hostMachines = createQuery(() => ({
		...allHostMachinesQueryOptions(),
		enabled: this.canReadListings,
	}));
	readonly pending = $derived(
		this.#scheduling.isPending ||
			this.draining.isPending ||
			this.remove.isPending ||
			this.revoke.isPending
	);
	confirming = $state<MachineConfirm | null>(null);
	#pageActions = $state.raw<readonly HeaderAction[]>([]);

	readonly host: HostMachine | undefined = $derived.by(() => {
		const machineId = this.query.data?.id;
		return machineId
			? this.hostMachines.data?.find((host) => host.machineId === machineId)
			: undefined;
	});

	get complaintCount(): number | undefined {
		return this.complaints.data?.length;
	}

	readonly headerActions: HeaderAction[] = $derived.by(() => {
		const machine = this.query.data;
		if (!machine) return [];
		return [
			{
				id: 'scheduling',
				label: machineSchedulingActionLabel(machine),
				icon: machine.unschedulable ? Play : Pause,
				onSelect: this.toggleScheduling,
				disabled: this.pending,
				visible: this.canWrite && machine.state !== MachineState.Decommissioned,
			},
			...this.#pageActions,
		];
	});

	readonly menuActions: ResourceRowAction[] = $derived.by(() => {
		const machine = this.query.data;
		if (!machine) return [];
		const lifecycle = machine.state !== MachineState.Decommissioned;
		return [
			{
				icon: Copy,
				label: 'Copy machine ID',
				onSelect: () => void copyWithToast(machine.id, MACHINE_ID_LABEL),
			},
			{
				icon: Ban,
				label: 'Revoke identity',
				onSelect: () => (this.confirming = 'revoke'),
				visible: this.canDelete,
			},
			{
				icon: PowerOff,
				label: machine.draining ? 'Return to service' : 'Decommission',
				onSelect: this.requestDrainingChange,
				destructive: !machine.draining,
				disabled: this.pending,
				visible: this.canWrite && lifecycle,
			},
			{
				icon: Trash,
				label: 'Delete',
				destructive: true,
				onSelect: () => (this.confirming = 'delete'),
				disabled: this.pending || !machineDeletable(machine),
				disabledReason: machineDeletable(machine)
					? undefined
					: MACHINE_DELETE_REQUIRES_PAUSE,
				visible: this.canDelete,
			},
		];
	});

	constructor(machineId: () => string) {
		this.query = createQuery(() => machineQueryOptions(machineId()));
		this.trust = createQuery(() => machineTrustQueryOptions(machineId()));
		this.complaints = createQuery(() => ispComplaintsQueryOptions(machineId()));
	}

	get machine(): Machine {
		const machine = this.query.data;
		if (!machine) {
			throw new Error('The machine detail was read before the machine loaded');
		}
		return machine;
	}

	usePageActions = (actions: () => readonly HeaderAction[]): void => {
		$effect(() => {
			this.#pageActions = actions();
			return () => {
				this.#pageActions = [];
			};
		});
	};

	refresh = async (): Promise<void> => {
		await Promise.all([this.query.refetch(), this.trust.refetch()]);
	};

	toggleScheduling = (): void => {
		this.#scheduling.mutate(this.machine, {
			onSuccess: () => void this.refresh(),
		});
	};

	setDraining = (draining: boolean): void => {
		this.draining.mutate(
			{ draining, machine: this.machine },
			{
				onSuccess: () => {
					this.confirming = null;
					toast.success(machineWithdrawalMessage(draining));
					void this.refresh();
				},
			}
		);
	};

	requestDrainingChange = (): void => {
		if (this.machine.draining) this.setDraining(false);
		else this.confirming = 'drain';
	};

	deleteMachine = (): void => {
		this.remove.mutate(this.machine, {
			onSuccess: () => {
				this.confirming = null;
				void goto(resolve(Path.MACHINES));
			},
		});
	};

	revokeIdentity = (): void => {
		this.revoke.mutate(this.machine, {
			onSuccess: () => {
				this.confirming = null;
				void this.refresh();
			},
		});
	};

	cancelConfirm = (): void => {
		this.confirming = null;
	};
}

export const [getMachineDetail, setMachineDetail] =
	createContext<MachineDetail>();
