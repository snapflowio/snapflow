/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createQuery } from '@tanstack/svelte-query';
import { Debounced } from 'runed';
import { allMachinesQueryOptions } from '#lib/api/machines/machines.ts';
import { sandboxListQueryOptions } from '#lib/api/sandboxes/sandboxes.ts';
import { allSnapshotsQueryOptions } from '#lib/api/snapshots.ts';
import {
	machineScopeItem,
	namedMatching,
	PALETTE_SCOPES,
	PALETTE_SEARCH_LIMIT,
	type PaletteScope,
	PaletteScopeId,
	type PaletteScopeItem,
	sandboxScopeItem,
	snapshotScopeItem,
} from '#lib/features/dashboard/lib/palette-scopes.ts';
import { getGlobalCommands } from '#lib/features/dashboard/state/global-commands.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

const SEARCH_DEBOUNCE_MS = 250;

export class PaletteSearch {
	scope = $state<PaletteScopeId | null>(null);
	search = $state('');
	readonly #permission = getOrganizationPermission();
	readonly #commands = getGlobalCommands();
	readonly #term = new Debounced(() => this.search.trim(), SEARCH_DEBOUNCE_MS);
	readonly #name = $derived(this.#term.current || undefined);

	readonly scopes: readonly PaletteScope[] = $derived(
		Object.values(PALETTE_SCOPES).filter((scope) =>
			this.#permission.can(scope.permission)
		)
	);
	readonly activeScope: PaletteScope | null = $derived(
		this.scope ? PALETTE_SCOPES[this.scope] : null
	);
	readonly #liveScope: PaletteScopeId | null = $derived.by(() => {
		if (this.scope) return this.scope;
		if (!this.#term.current) return null;
		return this.scopes.some((scope) => scope.id === PaletteScopeId.Sandboxes)
			? PaletteScopeId.Sandboxes
			: null;
	});

	readonly #sandboxes = createQuery(() => ({
		...sandboxListQueryOptions({
			name: this.#name,
			limit: PALETTE_SEARCH_LIMIT,
		}),
		enabled: this.#searching(PaletteScopeId.Sandboxes),
	}));
	readonly #machines = createQuery(() => ({
		...allMachinesQueryOptions(),
		enabled: this.#searching(PaletteScopeId.Machines),
	}));
	readonly #snapshots = createQuery(() => ({
		...allSnapshotsQueryOptions(),
		enabled: this.#searching(PaletteScopeId.Snapshots),
	}));

	readonly items: readonly PaletteScopeItem[] = $derived.by(() => {
		switch (this.#liveScope) {
			case PaletteScopeId.Sandboxes:
				return (this.#sandboxes.data?.items ?? []).map(sandboxScopeItem);
			case PaletteScopeId.Machines:
				return namedMatching(this.#machines.data ?? [], this.#term.current).map(
					machineScopeItem
				);
			case PaletteScopeId.Snapshots:
				return namedMatching(
					this.#snapshots.data ?? [],
					this.#term.current
				).map(snapshotScopeItem);
			default:
				return [];
		}
	});

	readonly fetching = $derived.by(() => {
		switch (this.#liveScope) {
			case PaletteScopeId.Sandboxes:
				return this.#sandboxes.isFetching;
			case PaletteScopeId.Machines:
				return this.#machines.isFetching;
			case PaletteScopeId.Snapshots:
				return this.#snapshots.isFetching;
			default:
				return false;
		}
	});

	#searching(id: PaletteScopeId): boolean {
		return this.#commands.paletteOpen && this.#liveScope === id;
	}

	enter = (id: PaletteScopeId): void => {
		this.scope = id;
		this.search = '';
	};

	reset = (): void => {
		this.scope = null;
		this.search = '';
	};
}
