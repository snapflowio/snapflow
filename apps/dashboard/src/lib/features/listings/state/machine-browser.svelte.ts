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
import {
	filterTagParts,
	type ResourceFilterTag,
	type ResourceSegment,
} from '#lib/components/resource/resource-options.ts';
import {
	MACHINE_CATEGORY_LABELS,
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
import { locationOptions } from '#lib/features/locations/lib/location-format.ts';
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

const ALL_CATEGORIES = 'all';
const CATEGORY_KEY: MachineBrowseKey = 'category';
const CATEGORY_VALUES: ReadonlySet<string> = new Set(MACHINE_CATEGORY_ORDER);

function isMachineCategory(value: string): value is MachineCategory {
	return CATEGORY_VALUES.has(value);
}

export const LISTING_SEGMENTS: readonly ResourceSegment[] = [
	{ value: ALL_CATEGORIES, label: 'All' },
	...MACHINE_CATEGORY_ORDER.map((category) => ({
		value: category,
		label: MACHINE_CATEGORY_LABELS[category],
	})),
];

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
				search: this.params.search,
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
		machineFilterTags(this.params)
			.filter((tag) => !tag.keys.includes(CATEGORY_KEY))
			.map((tag) => ({
				...filterTagParts(tag.label),
				onRemove: () => this.update(resetKeys(tag.keys)),
			}))
	);
	readonly filterCount = $derived(this.filterTags.length);
	readonly machines: MachineListing[] = $derived(
		this.listingsQuery.data?.pages.flatMap((page) => page.items) ?? []
	);
	readonly query = $derived(this.params.search.trim());
	readonly segment = $derived(this.params.category ?? ALL_CATEGORIES);
	readonly narrowingTags: ResourceFilterTag[] = $derived.by(() => {
		const category = this.params.category;
		if (category === null) return this.filterTags;
		return [
			{
				field: 'Category',
				value: MACHINE_CATEGORY_LABELS[category],
				onRemove: () => this.changeSegment(ALL_CATEGORIES),
			},
			...this.filterTags,
		];
	});
	readonly narrowed = $derived(
		Boolean(this.query) || this.filterCount > 0 || this.params.category !== null
	);

	update = (patch: MachineBrowsePatch): void => {
		void this.#params.update(patch);
	};

	changeSegment = (value: string): void => {
		this.update({ category: isMachineCategory(value) ? value : undefined });
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
}
