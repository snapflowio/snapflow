/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	MachineBrowseSort,
	MachineCategory,
	MachineListing,
} from '@snapflow/api-client';
import {
	createInfiniteQuery,
	createQuery,
	keepPreviousData,
} from '@tanstack/svelte-query';
import { listingsInfiniteQueryOptions } from '#lib/api/listings.ts';
import { machineLocationsQueryOptions } from '#lib/api/locations.ts';
import type { ResourceFilterTag } from '#lib/components/resource/resource-options.ts';
import {
	formatGpu,
	MACHINE_CATEGORY_ORDER,
} from '#lib/features/listings/lib/listing-format.ts';
import {
	browseFilters,
	browseShape,
	listingShapeSchema,
	MACHINE_FILTER_KEYS,
	type MachineBrowseKey,
	type MachineBrowseParams,
	machineBrowseSchema,
	machineFilterTags,
} from '#lib/features/listings/lib/machine-browse-params.ts';
import {
	DEFAULT_MACHINE_SORT,
	type MachineShapeInput,
	machineListQuery,
} from '#lib/features/listings/lib/machine-filters.ts';
import {
	locationLabel,
	locationOptions,
} from '#lib/features/locations/lib/location-format.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import {
	type SearchParamsPatch,
	withSearchParams,
} from '#lib/routing/search-params.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const MACHINE_PAGE_SIZE = 50;
const DEPLOY_MACHINE_SEARCH_PARAM = 'machine';

type MachineBrowsePatch = SearchParamsPatch<typeof machineBrowseSchema>;

export interface ListingSection {
	category: MachineCategory;
	machines: MachineListing[];
}

function resetKeys(keys: readonly MachineBrowseKey[]): MachineBrowsePatch {
	return Object.fromEntries(keys.map((key) => [key, undefined]));
}

export function listingDetailHref(
	machineId: string,
	shape: MachineShapeInput
): string {
	const base = new URL(
		resolve('/(app)/(dashboard)/listings/[machineId]', { machineId }),
		'http://snapflow.local'
	);
	const next = withSearchParams(listingShapeSchema, base, { ...shape });
	return `${next.pathname}${next.search}`;
}

export function deployOnMachine(machineId: string): void {
	const search = new URLSearchParams({
		[DEPLOY_MACHINE_SEARCH_PARAM]: machineId,
	});
	void goto(`${resolve(Path.SANDBOXES)}?${search}`);
}

export class MachineBrowser {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(machineBrowseSchema);
	readonly search = this.#params.text('search');
	readonly maxHourlyPrice = this.#params.text('maxHourlyPriceUsd');
	readonly maxEgressPrice = this.#params.text('maxEgressPriceUsd');
	readonly canDeploy = $derived(this.#permission.can({ sandboxes: ['write'] }));
	readonly params: MachineBrowseParams = $derived(this.#params.current);
	readonly filters = $derived(browseFilters(this.params));
	readonly sort: MachineBrowseSort = $derived(this.params.sort);
	readonly shape: MachineShapeInput = $derived(browseShape(this.params));
	readonly listingsQuery = createInfiniteQuery(() => ({
		...listingsInfiniteQueryOptions(
			machineListQuery({
				filters: this.filters,
				limit: MACHINE_PAGE_SIZE,
				shape: this.shape,
				sort: this.sort,
			})
		),
		initialPageParam: {},
		getNextPageParam: (page: { nextCursor?: string | null }) =>
			page.nextCursor ?? undefined,
		placeholderData: keepPreviousData,
	}));
	readonly #locationsQuery = createQuery(() => machineLocationsQueryOptions());
	readonly locationOptions = $derived(
		locationOptions(this.#locationsQuery.data?.continents ?? [])
	);
	readonly filterTags: ResourceFilterTag[] = $derived(
		machineFilterTags(this.params).map((tag) => ({
			label: tag.label,
			onRemove: () => this.update(resetKeys(tag.keys)),
		}))
	);
	readonly filterCount = $derived(this.filterTags.length);
	readonly machines: MachineListing[] = $derived(
		this.listingsQuery.data?.pages.flatMap((page) => page.items) ?? []
	);
	readonly query = $derived(this.search.value.trim());
	readonly sections: ListingSection[] = $derived.by(() => {
		const needle = this.query.toLowerCase();
		const visible = needle
			? this.machines.filter((machine) => this.#matches(machine, needle))
			: this.machines;
		return MACHINE_CATEGORY_ORDER.map((category) => ({
			category,
			machines: visible.filter((machine) => machine.category === category),
		})).filter((section) => section.machines.length > 0);
	});

	update = (patch: MachineBrowsePatch): void => {
		void this.#params.update(patch);
	};

	clearFilters = (): void => {
		this.update(resetKeys(MACHINE_FILTER_KEYS));
	};

	clearSearch = (): void => {
		this.search.value = '';
		void this.search.flush();
	};

	clearSort = (): void => {
		this.update({ sort: DEFAULT_MACHINE_SORT });
	};

	loadMore = (): void => {
		if (
			this.listingsQuery.hasNextPage &&
			!this.listingsQuery.isFetchingNextPage
		)
			void this.listingsQuery.fetchNextPage();
	};

	detailHref = (machine: MachineListing): string =>
		listingDetailHref(machine.machineId, this.shape);

	#matches(machine: MachineListing, needle: string): boolean {
		return [
			machine.name,
			machine.hostName,
			machine.cpuModel ?? '',
			locationLabel(machine.location),
			machine.gpuCount > 0 ? formatGpu(machine) : '',
		].some((value) => value.toLowerCase().includes(needle));
	}
}
