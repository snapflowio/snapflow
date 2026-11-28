/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { HostMachine, Machine } from '@snapflow/api-client';
import { renderComponent } from '@tanstack/svelte-table';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { resourceTextCell } from '#lib/components/resource/table/resource-cells.ts';
import type { ResourceTableBreakpoint } from '#lib/components/resource/table/resource-table.ts';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { locationLabel } from '#lib/features/locations/lib/location-format.ts';
import MachineCapacityCell from '#lib/features/machines/components/cells/machine-capacity-cell.svelte';
import MachineCheckedCell from '#lib/features/machines/components/cells/machine-checked-cell.svelte';
import MachineListingCell from '#lib/features/machines/components/cells/machine-listing-cell.svelte';
import MachineMoneyCell from '#lib/features/machines/components/cells/machine-money-cell.svelte';
import MachineNameCell from '#lib/features/machines/components/cells/machine-name-cell.svelte';
import {
	MachineListingStatus,
	machineListingStatus,
} from './machine-listing-status.ts';

const HOURLY_UNIT = '/h';
const LISTING_STATUS_RANK = Object.values(MachineListingStatus);
const MISSING_RANK = LISTING_STATUS_RANK.length;
const MISSING_AMOUNT = -1;
const COLUMN_PX = {
	state: 104,
	capacity: 128,
	checked: 112,
	listing: 112,
	price: 96,
	earned: 104,
} as const;
const NAME_COLUMN_GROW = 2;
const LOCATION_COLUMN_GROW = 1;

const column = resourceColumnHelper<Machine>();

export interface MachineHostData {
	host: (machineId: string) => HostMachine | undefined;
	earnedMicroUsd: (machineId: string) => string | undefined;
}

export const machineNameColumn = (sublabel?: (machine: Machine) => string) =>
	column.accessor('name', {
		id: 'name',
		header: 'Machine',
		meta: { grow: NAME_COLUMN_GROW },
		cell: ({ row }) =>
			renderComponent(MachineNameCell, {
				name: row.original.name,
				sublabel: sublabel?.(row.original),
			}),
	});

export const machineStateColumn = () =>
	column.accessor('state', {
		id: 'state',
		header: 'State',
		meta: { width: COLUMN_PX.state },
		cell: ({ row }) =>
			renderComponent(ResourceStateBadge, {
				state: row.original.state,
				errorReason: row.original.readinessReason,
			}),
	});

export const machineLocationColumn = (visibleFrom?: ResourceTableBreakpoint) =>
	column.accessor((machine) => locationLabel(machine.location), {
		id: 'location',
		header: 'Location',
		meta: { grow: LOCATION_COLUMN_GROW, visibleFrom },
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	});

export const machineCapacityColumn = (visibleFrom?: ResourceTableBreakpoint) =>
	column.accessor((machine) => machine.currentAllocatedCpu ?? 0, {
		id: 'capacity',
		header: 'Capacity',
		meta: { width: COLUMN_PX.capacity, visibleFrom },
		cell: ({ row }) =>
			renderComponent(MachineCapacityCell, { machine: row.original }),
	});

export const machineCheckedColumn = (visibleFrom?: ResourceTableBreakpoint) =>
	column.accessor((machine) => machine.lastChecked ?? '', {
		id: 'checked',
		header: 'Last seen',
		meta: { width: COLUMN_PX.checked, visibleFrom },
		cell: ({ row }) =>
			renderComponent(MachineCheckedCell, { value: row.original.lastChecked }),
	});

export const machineListingColumn = (
	data: MachineHostData,
	visibleFrom?: ResourceTableBreakpoint
) =>
	column.accessor(
		(machine) => {
			const host = data.host(machine.id);
			return host
				? LISTING_STATUS_RANK.indexOf(machineListingStatus(host))
				: MISSING_RANK;
		},
		{
			id: 'listing',
			header: 'Listing',
			meta: { width: COLUMN_PX.listing, visibleFrom },
			cell: ({ row }) =>
				renderComponent(MachineListingCell, {
					host: data.host(row.original.id),
				}),
		}
	);

export const machinePriceColumn = (
	data: MachineHostData,
	visibleFrom?: ResourceTableBreakpoint
) =>
	column.accessor(
		(machine) => {
			const card = data.host(machine.id)?.currentPriceCard;
			return card ? Number(card.machineHourMicroUsd) : MISSING_AMOUNT;
		},
		{
			id: 'price',
			header: 'Price',
			meta: { align: 'end', width: COLUMN_PX.price, visibleFrom },
			cell: ({ row }) =>
				renderComponent(MachineMoneyCell, {
					microUsd: data.host(row.original.id)?.currentPriceCard
						?.machineHourMicroUsd,
					unit: HOURLY_UNIT,
				}),
		}
	);

export const machineEarnedColumn = (
	data: MachineHostData,
	visibleFrom?: ResourceTableBreakpoint
) =>
	column.accessor(
		(machine) => Number(data.earnedMicroUsd(machine.id) ?? MISSING_AMOUNT),
		{
			id: 'earned',
			header: 'Earned',
			meta: { align: 'end', width: COLUMN_PX.earned, visibleFrom },
			cell: ({ row }) =>
				renderComponent(MachineMoneyCell, {
					microUsd: data.earnedMicroUsd(row.original.id),
				}),
		}
	);
