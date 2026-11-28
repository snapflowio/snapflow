/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createQuery } from '@tanstack/svelte-query';
import { PersistedState } from 'runed';
import { createContext } from 'svelte';
import { allMachinesQueryOptions } from '#lib/api/machines/machines.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import {
	DASHBOARD_MODE_STORAGE_KEY,
	DashboardMode,
	isDashboardMode,
} from '#lib/features/dashboard/lib/dashboard-mode.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

type StoredModes = Partial<Record<string, DashboardMode>>;

export class DashboardModeState {
	readonly #auth = getAuth();
	readonly #permission = getOrganizationPermission();
	readonly #stored = new PersistedState<StoredModes>(
		DASHBOARD_MODE_STORAGE_KEY,
		{},
		{ syncTabs: false }
	);
	readonly #userId = $derived(this.#auth.user?.id ?? null);
	readonly #canReadMachines = $derived(
		this.#permission.can({ machines: ['read'] })
	);
	readonly #machines = createQuery(() => ({
		...allMachinesQueryOptions(),
		enabled: this.#canReadMachines,
	}));

	readonly current: DashboardMode = $derived.by(() => {
		const stored = this.#userId ? this.#stored.current[this.#userId] : null;
		return stored && isDashboardMode(stored) ? stored : DashboardMode.Deploy;
	});
	readonly startHosting = $derived(
		!this.#canReadMachines ||
			(this.#machines.isSuccess && this.#machines.data.length === 0)
	);

	set = (mode: DashboardMode): void => {
		const userId = this.#userId;
		if (!userId || mode === this.current) return;
		this.#stored.current = { ...this.#stored.current, [userId]: mode };
	};
}

export const [getDashboardMode, setDashboardMode] =
	createContext<DashboardModeState>();
