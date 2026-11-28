/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createQuery } from '@tanstack/svelte-query';
import {
	listingQueryOptions,
	placementListingsQueryOptions,
} from '#lib/api/listings.ts';

export interface PlacementMachineOptionsArgs {
	enabled: boolean;
	selectedMachineId: string;
}

export class PlacementMachines {
	readonly options;

	constructor(args: () => PlacementMachineOptionsArgs) {
		const machines = createQuery(() => ({
			...placementListingsQueryOptions(),
			enabled: args().enabled,
		}));
		const missingSelection = $derived(
			Boolean(args().selectedMachineId) &&
				machines.isSuccess &&
				!machines.data.items.some(
					(machine) => machine.machineId === args().selectedMachineId
				)
		);
		const selected = createQuery(() => ({
			...listingQueryOptions(args().selectedMachineId),
			enabled: args().enabled && missingSelection,
		}));
		this.options = $derived.by(() => {
			const listed = machines.data?.items ?? [];
			const all =
				missingSelection && selected.data ? [selected.data, ...listed] : listed;
			return all.map((machine) => ({
				label: `${machine.name} · ${machine.hostName}`,
				value: machine.machineId,
			}));
		});
	}
}
