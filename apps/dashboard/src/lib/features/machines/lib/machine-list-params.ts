/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type HostMachine,
	type Machine,
	MachineState,
} from '@snapflow/api-client';
import * as z from 'zod';
import type {
	ResourceSegment,
	ResourceSortOption,
} from '#lib/components/resource/resource-options.ts';
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
import { machineNeedsAttention, machineOnline } from './machine-attention.ts';
import {
	MachineListingStatus,
	machineListingStatus,
} from './machine-listing-status.ts';

const MACHINE_SCHEDULING = {
	available: 'available',
	paused: 'paused',
} as const;

type MachineScheduling =
	(typeof MACHINE_SCHEDULING)[keyof typeof MACHINE_SCHEDULING];

export const MachineListView = {
	All: 'all',
	Online: 'online',
	Offline: 'offline',
	Attention: 'attention',
} as const;

export type MachineListView =
	(typeof MachineListView)[keyof typeof MachineListView];

const VIEW_LABELS: Record<MachineListView, string> = {
	[MachineListView.All]: 'All',
	[MachineListView.Online]: 'Online',
	[MachineListView.Offline]: 'Offline',
	[MachineListView.Attention]: 'Needs attention',
};

const VIEW_MATCHERS: Record<MachineListView, (machine: Machine) => boolean> = {
	[MachineListView.All]: () => true,
	[MachineListView.Online]: machineOnline,
	[MachineListView.Offline]: (machine) => !machineOnline(machine),
	[MachineListView.Attention]: machineNeedsAttention,
};

const LISTED_ONLY = 'true';

const SORT_COLUMNS = [
	'name',
	'state',
	'location',
	'price',
	'earned',
	'checked',
] as const;

type MachineSortColumn = (typeof SORT_COLUMNS)[number];

const SORT_LABELS: Record<MachineSortColumn, string> = {
	name: 'Name',
	state: 'State',
	location: 'Location',
	price: 'Price',
	earned: 'Earned',
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
	view: z.enum(MachineListView).catch(MachineListView.All),
	state: searchParamArray(z.enum(MachineState)).catch([]),
	location: searchParamArray(z.string()).catch([]),
	scheduling: searchParamArray(z.enum(MACHINE_SCHEDULING)).catch([]),
	listed: z.literal(LISTED_ONLY).nullable().catch(null),
	sort: z.enum(SORT_COLUMNS).nullable().catch(null),
	dir: z.enum(['asc', 'desc']).catch('desc'),
});

export type MachineListParams = SearchParamsValues<typeof machineListSchema>;

export type MachineFilterPatch = Partial<
	Pick<MachineListParams, 'state' | 'location' | 'scheduling' | 'listed'>
>;

export const CLEARED_MACHINE_FILTERS = {
	state: [],
	location: [],
	scheduling: [],
	listed: null,
} as const satisfies MachineFilterPatch;

export function listedOnlyPatch(listedOnly: boolean): MachineFilterPatch {
	return { listed: listedOnly ? LISTED_ONLY : null };
}

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

export function isMachineListView(value: string): value is MachineListView {
	return Object.values<string>(MachineListView).includes(value);
}

function machineScheduling(machine: Machine): MachineScheduling {
	return machine.unschedulable
		? MACHINE_SCHEDULING.paused
		: MACHINE_SCHEDULING.available;
}

function matchesListed(
	machine: Machine,
	params: MachineListParams,
	hosts: ReadonlyMap<string, HostMachine>
): boolean {
	if (params.listed === null) return true;
	const host = hosts.get(machine.id);
	return (
		host !== undefined &&
		machineListingStatus(host) === MachineListingStatus.Listed
	);
}

export function filterMachines(
	machines: readonly Machine[],
	params: MachineListParams,
	hosts: ReadonlyMap<string, HostMachine>
): Machine[] {
	const query = params.search.trim().toLowerCase();
	const inView = VIEW_MATCHERS[params.view];
	return machines.filter(
		(machine) =>
			inView(machine) &&
			(params.state.length === 0 || params.state.includes(machine.state)) &&
			matchesLocation(machine.location, params.location) &&
			(params.scheduling.length === 0 ||
				params.scheduling.includes(machineScheduling(machine))) &&
			matchesListed(machine, params, hosts) &&
			(!query ||
				machine.id.toLowerCase().includes(query) ||
				machine.name.toLowerCase().includes(query) ||
				locationLabel(machine.location).toLowerCase().includes(query))
	);
}

export function machineListSegments(
	machines: readonly Machine[]
): ResourceSegment<MachineListView>[] {
	return Object.values(MachineListView).map((view) => ({
		value: view,
		label: VIEW_LABELS[view],
		count:
			view === MachineListView.All
				? undefined
				: machines.filter(VIEW_MATCHERS[view]).length,
	}));
}

export interface MachineFilterTag {
	key: keyof MachineFilterPatch;
	field: string;
	value: string;
}

export function machineFilterTags(
	params: MachineListParams
): MachineFilterTag[] {
	const tags: MachineFilterTag[] = [];
	if (params.state.length > 0) {
		tags.push({
			key: 'state',
			field: 'State',
			value: params.state.map((state) => STATE_LABELS[state]).join(', '),
		});
	}
	if (params.location.length > 0) {
		tags.push({
			key: 'location',
			field: 'Location',
			value: params.location.map(locationCodeLabel).join(', '),
		});
	}
	if (params.scheduling.length > 0) {
		tags.push({
			key: 'scheduling',
			field: 'Scheduling',
			value: params.scheduling
				.map((value) => SCHEDULING_LABELS[value])
				.join(', '),
		});
	}
	if (params.listed !== null) {
		tags.push({ key: 'listed', field: 'Listing', value: 'Listed' });
	}
	return tags;
}
