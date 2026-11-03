/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Machine, MachineState } from '@snapflow/api-client';
import * as z from 'zod';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import {
	adminFilterField,
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { titleCase } from '#lib/utils/text.ts';

export const MACHINE_SORT_OPTIONS = [
	{ id: 'name', label: 'Name' },
	{ id: 'location', label: 'Location' },
	{ id: 'checked', label: 'Last checked' },
] as const;

export const MACHINE_SCHEDULING_LABELS = {
	available: 'Available',
	paused: 'Paused',
} as const;

export const MACHINE_STATE_OPTIONS = Object.values(MachineState).map(
	(state) => ({
		label: titleCase(state),
		value: state,
	})
);

export const MACHINE_FILTER_KEYS = ['state', 'location', 'scheduling'] as const;

export const NEVER_CHECKED = 'Never';

export const machinesSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['name', 'location', 'checked']),
	state: searchParamArray(z.enum(MachineState)).catch([]),
	location: searchParamArray(z.string()).catch([]),
	scheduling: adminFilterField(['available', 'paused']),
});

export function decommissionMachineCopy(
	machine: Machine | null
): ChipConfirmCopy {
	return {
		title: 'Start decommissioning',
		text: [
			'Decommissioning ',
			{ text: machine?.name ?? 'this machine', bold: true },
			' stops new workloads and migrates existing ones. ',
			{
				text: 'When draining completes, its identity is revoked and it must be enrolled again before it can reconnect.',
				error: true,
			},
		],
		confirmLabel: 'Decommission',
		pendingLabel: 'Starting...',
	};
}

export function deleteAdminMachineCopy(
	machine: Machine | null
): ChipConfirmCopy {
	return {
		title: 'Delete machine',
		text: [
			'Are you sure you want to delete ',
			{ text: machine?.name ?? 'this machine', bold: true },
			'? ',
			{ text: 'The machine is permanently removed.', error: true },
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}
