/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Snippet } from 'svelte';

export type DashboardAsideVariant = 'context' | 'panel';

export interface DashboardAsideItem {
	label: string;
	variant: DashboardAsideVariant;
	content: Snippet;
	width?: number;
	transparent?: boolean;
}

class DashboardAsideState {
	context = $state.raw<DashboardAsideItem | null>(null);
	panel = $state.raw<DashboardAsideItem | null>(null);
	current = $derived(this.panel ?? this.context);

	show(item: DashboardAsideItem): () => void {
		const slot = item.variant;
		this[slot] = item;
		return () => {
			if (this[slot] === item) this[slot] = null;
		};
	}
}

export const dashboardAside = new DashboardAsideState();

export function useDashboardAside(item: () => DashboardAsideItem | null): void {
	$effect(() => {
		const current = item();
		if (!current) return;
		return dashboardAside.show(current);
	});
}
