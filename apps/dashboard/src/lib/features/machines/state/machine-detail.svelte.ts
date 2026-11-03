/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Pause from '@lucide/svelte/icons/pause';
import { type Machine, MachineState } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { createContext } from 'svelte';
import {
	deleteMachineMutationOptions,
	machineQueryOptions,
	machineTrustQueryOptions,
	organizationMachineOperations,
	revokeMachineIdentityMutationOptions,
	toggleMachineSchedulingMutationOptions,
	updateMachineDrainingMutationOptions,
} from '#lib/api/machines.ts';
import Play from '#lib/components/icons/play.svelte';
import Redo from '#lib/components/icons/redo.svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	machineDrainingMessage,
	machineSchedulingActionLabel,
} from '#lib/features/machines/lib/machine-format.ts';
import { machineRowActions } from '#lib/features/machines/lib/machine-row-actions.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

type MachineConfirm = 'delete' | 'drain' | 'revoke';

export class MachineDetail {
	readonly query;
	readonly trust;
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
	readonly pending = $derived(
		this.#scheduling.isPending ||
			this.draining.isPending ||
			this.remove.isPending ||
			this.revoke.isPending
	);
	confirming = $state<MachineConfirm | null>(null);

	readonly headerActions: HeaderAction[] = $derived.by(() => {
		const machine = this.query.data;
		if (!machine) return [];
		return [
			{
				id: 'refresh',
				label: 'Refresh',
				icon: Redo,
				onSelect: () => void this.refresh(),
				disabled: this.query.isFetching,
			},
			{
				id: 'scheduling',
				label: machineSchedulingActionLabel(machine),
				icon: machine.unschedulable ? Play : Pause,
				onSelect: this.toggleScheduling,
				disabled: this.pending,
				visible: this.canWrite && machine.state !== MachineState.Decommissioned,
			},
			{
				id: 'delete',
				kind: 'delete',
				label: 'Delete',
				onSelect: () => (this.confirming = 'delete'),
				disabled: this.pending,
				visible: this.canDelete,
			},
		];
	});

	readonly crumbActions: ResourceRowAction[] = $derived.by(() => {
		const machine = this.query.data;
		if (!machine) return [];
		return machineRowActions(machine, {
			onToggleScheduling: this.canWrite ? this.toggleScheduling : undefined,
			onDrainingChange: this.canWrite ? this.requestDrainingChange : undefined,
			onRevokeIdentity: this.canDelete
				? () => (this.confirming = 'revoke')
				: undefined,
			onDelete: this.canDelete ? () => (this.confirming = 'delete') : undefined,
		});
	});

	constructor(machineId: () => string) {
		this.query = createQuery(() => machineQueryOptions(machineId()));
		this.trust = createQuery(() => machineTrustQueryOptions(machineId()));
	}

	get machine(): Machine {
		const machine = this.query.data;
		if (!machine) {
			throw new Error('The machine detail was read before the machine loaded');
		}
		return machine;
	}

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
					toast.success(machineDrainingMessage(draining));
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
