/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MachineState } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { allMachinesQueryOptions } from '#lib/api/machines/machines.ts';
import { DashboardMode } from '#lib/features/dashboard/lib/dashboard-mode.ts';
import {
	type DashboardNavigationItemView,
	getDashboardNavigation,
} from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';

export type SidebarNavCountTone = 'default' | 'error';

export interface SidebarNavCount {
	value: number;
	tone: SidebarNavCountTone;
	label: string;
}

const MACHINES_ITEM_ID = 'machines';
const FAULTY_MACHINE_STATES: ReadonlySet<MachineState> = new Set([
	MachineState.Failed,
	MachineState.Unresponsive,
]);

export class SidebarNavCounts {
	readonly #navigation = getDashboardNavigation();
	readonly #machines = createQuery(() => ({
		...allMachinesQueryOptions(),
		enabled:
			this.#navigation.mode.current === DashboardMode.Host &&
			this.#navigation.permission.can({ machines: ['read'] }),
	}));
	readonly #faultyMachines = $derived(
		(this.#machines.data ?? []).filter((machine) =>
			FAULTY_MACHINE_STATES.has(machine.state)
		).length
	);

	of = (id: DashboardNavigationItemView['id']): SidebarNavCount | undefined => {
		if (id !== MACHINES_ITEM_ID || this.#faultyMachines === 0) return undefined;
		return {
			value: this.#faultyMachines,
			tone: 'error',
			label: `${pluralize(this.#faultyMachines, 'machine')} offline or failed`,
		};
	};
}
