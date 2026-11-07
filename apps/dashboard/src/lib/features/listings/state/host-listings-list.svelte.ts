/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Pause from '@lucide/svelte/icons/pause';
import Plus from '@lucide/svelte/icons/plus';
import { type HostMachine, ListingState } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	allHostMachinesQueryOptions,
	requestBenchmarkMutationOptions,
	updateListingMutationOptions,
} from '#lib/api/listings.ts';
import Play from '#lib/components/icons/play.svelte';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import type {
	ResourceFilterTag,
	ResourceSortConfig,
} from '#lib/components/resource/resource-options.ts';
import type { ResourceRefreshInterval } from '#lib/components/resource/resource-refresh.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	hostListingRowActions,
	type ListingToggle,
	listingToggle,
} from '#lib/features/listings/lib/host-listing.ts';
import {
	CLEARED_HOST_LISTING_FILTERS,
	filterHostMachines,
	HOST_LISTING_SORT_OPTIONS,
	type HostListingFilterPatch,
	type HostListingParams,
	hostListingFilterTags,
	hostListingSchema,
	isHostListingSortColumn,
} from '#lib/features/listings/lib/host-listing-params.ts';
import { HostPayoutReadiness } from '#lib/features/listings/state/host-payout-readiness.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export class HostListingsList {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(hostListingSchema);
	readonly #updateListing = createMutation(() =>
		updateListingMutationOptions()
	);
	readonly #bulkUpdateListing = createMutation(() => {
		const options = updateListingMutationOptions();
		return { ...options, meta: { ...options.meta, success: undefined } };
	});
	readonly #requestBenchmark = createMutation(() =>
		requestBenchmarkMutationOptions()
	);
	#bulkPending = $state(false);

	readonly search = this.#params.text('search');
	readonly payout = new HostPayoutReadiness();

	refreshInterval = $state<ResourceRefreshInterval>(false);
	addOpen = $state(false);
	selectedIds = $state<string[]>([]);
	contextId = $state<string | null>(null);
	listing = $state.raw<HostMachine | null>(null);
	pricing = $state.raw<HostMachine | null>(null);

	readonly canRead = $derived(this.#permission.can({ listings: ['read'] }));
	readonly canWrite = $derived(this.#permission.can({ listings: ['write'] }));
	readonly canAddMachine = $derived(
		this.#permission.can({ machines: ['write'] })
	);
	readonly machinesQuery = createQuery(() => ({
		...allHostMachinesQueryOptions(),
		enabled: this.canRead,
		refetchInterval: this.refreshInterval,
	}));
	readonly params: HostListingParams = $derived(this.#params.current);
	readonly #allMachines: readonly HostMachine[] = $derived.by(
		() => this.machinesQuery.data ?? []
	);
	readonly #machinesById = $derived.by(
		() =>
			new Map(this.#allMachines.map((machine) => [machine.machineId, machine]))
	);
	readonly machines: HostMachine[] = $derived.by(() =>
		filterHostMachines(this.#allMachines, {
			...this.#params.current,
			search: this.search.value,
		})
	);
	readonly filterTags: ResourceFilterTag[] = $derived.by(() =>
		hostListingFilterTags(this.#params.current).map((tag) => ({
			label: tag.label,
			onRemove: () => void this.#params.update({ [tag.key]: [] }),
		}))
	);
	readonly trimmedSearch = $derived(this.search.value.trim());
	readonly hasQuery = $derived(
		this.trimmedSearch.length > 0 || this.filterTags.length > 0
	);
	readonly sort = $derived(
		this.#params.current.sort
			? {
					column: this.#params.current.sort,
					direction: this.#params.current.dir,
				}
			: undefined
	);
	readonly sortConfig: ResourceSortConfig = $derived.by(() => ({
		options: HOST_LISTING_SORT_OPTIONS,
		active: this.sort ?? null,
		onSort: (column, dir) => {
			if (isHostListingSortColumn(column))
				void this.#params.update({ sort: column, dir });
		},
		onClear: () => void this.#params.update({ sort: null, dir: 'desc' }),
	}));
	readonly #busy = $derived.by(
		() => this.#updateListing.isPending || this.#bulkPending
	);
	readonly #selectedMachines: HostMachine[] = $derived.by(() =>
		this.selectedIds.flatMap((id) => this.#machinesById.get(id) ?? [])
	);
	readonly #pauseTargets: HostMachine[] = $derived.by(() =>
		this.#selectedMachines.filter(
			(machine) => machine.listing.state === ListingState.Listed
		)
	);
	readonly #listTargets: HostMachine[] = $derived.by(() =>
		this.#selectedMachines.filter(
			(machine) =>
				machine.listing.state !== ListingState.Listed &&
				!listingToggle(machine, this.payout.ready).disabled
		)
	);
	readonly bulkActions: ResourceBulkAction[] = $derived.by(() =>
		this.canWrite
			? [
					{
						id: 'list',
						label: 'List',
						icon: Play,
						disabled: this.#busy || this.#listTargets.length === 0,
						onSelect: () => void this.#bulkToggle(this.#listTargets),
					},
					{
						id: 'pause',
						label: 'Pause',
						icon: Pause,
						disabled: this.#busy || this.#pauseTargets.length === 0,
						onSelect: () => void this.#bulkToggle(this.#pauseTargets),
					},
				]
			: []
	);
	readonly contextActions: ResourceRowAction[] = $derived.by(() => {
		const target = this.contextId
			? this.#machinesById.get(this.contextId)
			: undefined;
		if (
			target &&
			this.selectedIds.length > 1 &&
			this.selectedIds.includes(target.machineId)
		) {
			return [
				{
					icon: Play,
					label: `List ${pluralize(this.#listTargets.length, 'listing')}`,
					disabled: this.#busy,
					onSelect: () => void this.#bulkToggle(this.#listTargets),
					visible: this.canWrite && this.#listTargets.length > 0,
				},
				{
					icon: Pause,
					label: `Pause ${pluralize(this.#pauseTargets.length, 'listing')}`,
					disabled: this.#busy,
					onSelect: () => void this.#bulkToggle(this.#pauseTargets),
					visible: this.canWrite && this.#pauseTargets.length > 0,
				},
			];
		}
		if (target) return this.rowActions(target);
		return [
			{
				icon: Plus,
				label: 'Add machine',
				onSelect: this.openAdd,
				visible: this.canAddMachine,
			},
		];
	});

	openAdd = (): void => {
		this.addOpen = true;
	};

	rowActions = (machine: HostMachine): ResourceRowAction[] =>
		hostListingRowActions(machine, {
			payoutReady: this.payout.ready,
			busy: this.#busy || this.#requestBenchmark.isPending,
			onOpen: this.openListing,
			onEditListing: this.canWrite
				? (target) => {
						this.listing = target;
					}
				: undefined,
			onEditPrices: this.canWrite
				? (target) => {
						this.pricing = target;
					}
				: undefined,
			onRequestBenchmark: this.canWrite
				? (target) => this.#requestBenchmark.mutate(target.machineId)
				: undefined,
			onToggle: this.canWrite ? this.#toggleListing : undefined,
		});

	openListing = (machine: HostMachine): void => {
		void goto(
			resolve('/(app)/(dashboard)/listings/mine/[machineId]', {
				machineId: machine.machineId,
			})
		);
	};

	retarget = (_event: MouseEvent, machineId: string): void => {
		this.contextId = machineId;
		if (this.selectedIds.length > 0 && !this.selectedIds.includes(machineId)) {
			this.selectedIds = [machineId];
		}
	};

	clearContext = (): void => {
		this.contextId = null;
	};

	updateFilters = (patch: HostListingFilterPatch): void => {
		void this.#params.update(patch);
	};

	clearFilters = (): void => {
		void this.#params.update(CLEARED_HOST_LISTING_FILTERS);
	};

	clearQuery = (): void => {
		this.search.value = '';
		void this.#params.update({ search: '', ...CLEARED_HOST_LISTING_FILTERS });
	};

	#toggleListing = (machine: HostMachine, toggle: ListingToggle): void => {
		this.#updateListing.mutate({ machine, listing: toggle.listing });
	};

	async #bulkToggle(targets: readonly HostMachine[]): Promise<void> {
		if (targets.length === 0 || this.#bulkPending) return;
		this.#bulkPending = true;
		const results = await Promise.allSettled(
			targets.map((machine) =>
				this.#bulkUpdateListing.mutateAsync({
					machine,
					listing: listingToggle(machine, this.payout.ready).listing,
				})
			)
		);
		const updated = results.filter(
			(result) => result.status === 'fulfilled'
		).length;
		if (updated > 0) toast.success(`${pluralize(updated, 'listing')} updated`);
		this.selectedIds = [];
		this.#bulkPending = false;
	}
}
