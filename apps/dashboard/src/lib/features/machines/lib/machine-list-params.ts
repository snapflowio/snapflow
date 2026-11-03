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
import type { ResourceSortOption } from '#lib/components/resource/resource-options.ts';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import {
	locationCodeLabel,
	locationLabel,
	matchesLocation,
} from '#lib/features/locations/lib/location-format.ts';
import {
	type SearchParamsValues,
	searchParamArray,
} from '#lib/routing/search-params.ts';

const MACHINE_SCHEDULING = {
	available: 'available',
	paused: 'paused',
} as const;

type MachineScheduling =
	(typeof MACHINE_SCHEDULING)[keyof typeof MACHINE_SCHEDULING];

const SORT_COLUMNS = ['name', 'state', 'location', 'checked'] as const;

type MachineSortColumn = (typeof SORT_COLUMNS)[number];

const SORT_LABELS: Record<MachineSortColumn, string> = {
	name: 'Name',
	state: 'State',
	location: 'Location',
	checked: 'Last checked',
};

export const MACHINE_SORT_OPTIONS: readonly ResourceSortOption[] =
	SORT_COLUMNS.map((column) => ({ id: column, label: SORT_LABELS[column] }));

const STATE_LABELS: Record<MachineState, string> = {
	[MachineState.Initializing]: 'Initializing',
	[MachineState.Ready]: 'Ready',
	[MachineState.Draining]: 'Draining',
	[MachineState.Failed]: 'Failed',
	[MachineState.Disabled]: 'Disabled',
	[MachineState.Decommissioned]: 'Decommissioned',
	[MachineState.Unresponsive]: 'Unresponsive',
};

const SCHEDULING_LABELS: Record<MachineScheduling, string> = {
	[MACHINE_SCHEDULING.available]: 'Available',
	[MACHINE_SCHEDULING.paused]: 'Paused',
};

export const MACHINE_STATE_OPTIONS: ChipOption<MachineState>[] = Object.values(
	MachineState
).map((state) => ({ label: STATE_LABELS[state], value: state }));

export const MACHINE_SCHEDULING_OPTIONS: ChipOption<MachineScheduling>[] =
	Object.values(MACHINE_SCHEDULING).map((scheduling) => ({
		label: SCHEDULING_LABELS[scheduling],
		value: scheduling,
	}));

export const machineListSchema = z.object({
	search: z.string().catch(''),
	state: searchParamArray(z.enum(MachineState)).catch([]),
	location: searchParamArray(z.string()).catch([]),
	scheduling: searchParamArray(z.enum(MACHINE_SCHEDULING)).catch([]),
	sort: z.enum(SORT_COLUMNS).nullable().catch(null),
	dir: z.enum(['asc', 'desc']).catch('desc'),
});

export type MachineListParams = SearchParamsValues<typeof machineListSchema>;

export function isMachineSortColumn(
	column: string
): column is MachineSortColumn {
	return SORT_COLUMNS.some((candidate) => candidate === column);
}

export function isMachineState(value: string): value is MachineState {
	return Object.values<string>(MachineState).includes(value);
}

export function isMachineScheduling(value: string): value is MachineScheduling {
	return Object.values<string>(MACHINE_SCHEDULING).includes(value);
}

function machineScheduling(machine: Machine): MachineScheduling {
	return machine.unschedulable
		? MACHINE_SCHEDULING.paused
		: MACHINE_SCHEDULING.available;
}

export function filterMachines(
	machines: readonly Machine[],
	params: MachineListParams
): Machine[] {
	const query = params.search.trim().toLowerCase();
	return machines.filter(
		(machine) =>
			(params.state.length === 0 || params.state.includes(machine.state)) &&
			matchesLocation(machine.location, params.location) &&
			(params.scheduling.length === 0 ||
				params.scheduling.includes(machineScheduling(machine))) &&
			(!query ||
				machine.id.toLowerCase().includes(query) ||
				machine.name.toLowerCase().includes(query) ||
				locationLabel(machine.location).toLowerCase().includes(query))
	);
}

export interface MachineFilterTag {
	key: 'state' | 'location' | 'scheduling';
	label: string;
}

export function machineFilterTags(
	params: MachineListParams
): MachineFilterTag[] {
	const tags: MachineFilterTag[] = [];
	if (params.state.length > 0) {
		tags.push({
			key: 'state',
			label: `State: ${params.state.map((state) => STATE_LABELS[state]).join(', ')}`,
		});
	}
	if (params.location.length > 0) {
		tags.push({
			key: 'location',
			label: `Location: ${params.location.map(locationCodeLabel).join(', ')}`,
		});
	}
	if (params.scheduling.length > 0) {
		tags.push({
			key: 'scheduling',
			label: `Scheduling: ${params.scheduling.map((value) => SCHEDULING_LABELS[value]).join(', ')}`,
		});
	}
	return tags;
}
