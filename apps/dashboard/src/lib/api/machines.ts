/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	adminDeleteMachine,
	adminListMachines,
	adminUpdateMachineDraining,
	adminUpdateMachineScheduling,
	deleteMachine,
	listMachines,
	type Machine,
	revokeMachineIdentity,
	updateMachineDraining,
	updateMachineScheduling,
} from '@snapflow/api-client';
import {
	adminListMachinesQueryKey,
	getMachineByIdOptions,
	getMachineTrustOptions,
	getMachineTrustQueryKey,
	listMachinesQueryKey,
} from '@snapflow/api-client/svelte-query';
import {
	mutationOptions,
	type QueryKey,
	queryOptions,
} from '@tanstack/svelte-query';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';

export interface MachineDrainingChange {
	draining: boolean;
	machine: Machine;
}

export interface MachineLifecycleOperations {
	deleteMachine: (machine: Machine) => Promise<unknown>;
	listQueryKey: QueryKey;
	setDraining: (machine: Machine, draining: boolean) => Promise<unknown>;
	setUnschedulable: (
		machine: Machine,
		unschedulable: boolean
	) => Promise<unknown>;
}

export const organizationMachineOperations: MachineLifecycleOperations = {
	deleteMachine: (machine) => deleteMachine({ path: { id: machine.id } }),
	listQueryKey: listMachinesQueryKey(),
	setDraining: (machine, draining) =>
		updateMachineDraining({ path: { id: machine.id }, body: { draining } }),
	setUnschedulable: (machine, unschedulable) =>
		updateMachineScheduling({
			path: { id: machine.id },
			body: { unschedulable },
		}),
};

export const adminMachineOperations: MachineLifecycleOperations = {
	deleteMachine: (machine) => adminDeleteMachine({ path: { id: machine.id } }),
	listQueryKey: adminListMachinesQueryKey(),
	setDraining: (machine, draining) =>
		adminUpdateMachineDraining({
			path: { id: machine.id },
			body: { draining },
		}),
	setUnschedulable: (machine, unschedulable) =>
		adminUpdateMachineScheduling({
			path: { id: machine.id },
			body: { unschedulable },
		}),
};

export function machineQueryOptions(machineId: string) {
	return getMachineByIdOptions({ path: { id: machineId } });
}

export function machineTrustQueryOptions(machineId: string) {
	return queryOptions({
		...getMachineTrustOptions({ path: { machineId } }),
		retry: false,
	});
}

export function allMachinesQueryOptions() {
	return allPagesOptions(
		listMachinesQueryKey(),
		async (cursor, signal) =>
			(await listMachines({ query: { cursor }, signal })).data
	);
}

export function adminAllMachinesQueryOptions() {
	return allPagesOptions(
		adminListMachinesQueryKey(),
		async (cursor, signal) =>
			(await adminListMachines({ query: { cursor }, signal })).data
	);
}

export function toggleMachineSchedulingMutationOptions(
	operations: MachineLifecycleOperations
) {
	return mutationOptions({
		mutationFn: (machine: Machine) =>
			operations.setUnschedulable(machine, !machine.unschedulable),
		meta: {
			invalidates: [operations.listQueryKey],
			success: 'Machine scheduling updated',
			failure: 'Failed to update machine scheduling',
		},
	});
}

export function updateMachineDrainingMutationOptions(
	operations: MachineLifecycleOperations
) {
	return mutationOptions({
		mutationFn: async ({ draining, machine }: MachineDrainingChange) => {
			await operations.setDraining(machine, draining);
			return draining;
		},
		meta: {
			invalidates: [operations.listQueryKey],
			failure: 'Failed to update machine drain mode',
		},
	});
}

export function deleteMachineMutationOptions(
	operations: MachineLifecycleOperations
) {
	return mutationOptions({
		mutationFn: (machine: Machine) => operations.deleteMachine(machine),
		meta: {
			invalidates: [operations.listQueryKey],
			success: 'Machine deleted',
			failure: 'Failed to delete machine',
		},
	});
}

export function revokeMachineIdentityMutationOptions() {
	return mutationOptions({
		mutationFn: async (machine: Machine) => {
			await revokeMachineIdentity({ path: { id: machine.id } });
			return machine;
		},
		onSuccess: (machine, _variables, _result, context) =>
			context.client.invalidateQueries({
				queryKey: getMachineTrustQueryKey({ path: { machineId: machine.id } }),
			}),
		meta: {
			invalidates: [listMachinesQueryKey()],
			success: 'Machine identity revoked',
			failure: 'Failed to revoke machine identity',
		},
	});
}
