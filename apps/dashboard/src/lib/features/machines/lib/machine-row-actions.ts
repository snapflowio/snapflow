/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import Ban from '@lucide/svelte/icons/ban';
import Copy from '@lucide/svelte/icons/copy';
import Pause from '@lucide/svelte/icons/pause';
import PowerOff from '@lucide/svelte/icons/power-off';
import { type Machine, MachineState } from '@snapflow/api-client';
import Play from '#lib/components/icons/play.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	machineDrainingActionLabel,
	machineSchedulingActionLabel,
} from './machine-format.ts';

export interface MachineActionHandlers {
	onOpen?: (machine: Machine) => void;
	onToggleScheduling?: (machine: Machine) => void;
	onDrainingChange?: (machine: Machine) => void;
	onRevokeIdentity?: (machine: Machine) => void;
	onDelete?: (machine: Machine) => void;
}

export function copyMachineId(machine: Machine): void {
	void navigator.clipboard
		.writeText(machine.id)
		.then(() => toast.success('Machine ID copied'));
}

export function machineRowActions(
	machine: Machine,
	handlers: MachineActionHandlers
): ResourceRowAction[] {
	const lifecycle = machine.state !== MachineState.Decommissioned;
	const {
		onOpen,
		onToggleScheduling,
		onDrainingChange,
		onRevokeIdentity,
		onDelete,
	} = handlers;
	return [
		{
			icon: ArrowUpRight,
			label: 'Open',
			onSelect: () => onOpen?.(machine),
			visible: Boolean(onOpen),
		},
		{
			icon: machine.unschedulable ? Play : Pause,
			label: machineSchedulingActionLabel(machine),
			onSelect: () => onToggleScheduling?.(machine),
			visible: lifecycle && Boolean(onToggleScheduling),
		},
		{
			icon: PowerOff,
			label: machineDrainingActionLabel(machine),
			onSelect: () => onDrainingChange?.(machine),
			visible: lifecycle && Boolean(onDrainingChange),
		},
		{
			icon: Ban,
			label: 'Revoke identity',
			onSelect: () => onRevokeIdentity?.(machine),
			visible: Boolean(onRevokeIdentity),
		},
		{
			icon: Copy,
			label: 'Copy ID',
			onSelect: () => copyMachineId(machine),
		},
		{
			icon: Trash,
			label: 'Delete',
			onSelect: () => onDelete?.(machine),
			separated: true,
			visible: Boolean(onDelete),
		},
	];
}
