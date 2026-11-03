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
	ListingState,
	ListingVisibility,
	MachineTier,
} from '@snapflow/api-client';
import * as z from 'zod';
import type { ResourceSortOption } from '#lib/components/resource/resource-options.ts';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import {
	type SearchParamsValues,
	searchParamArray,
} from '#lib/routing/search-params.ts';
import { HOST_LISTING_STATE_ORDER } from './host-listing.ts';
import {
	formatListingSpecs,
	LISTING_STATE_LABELS,
	LISTING_VISIBILITY_LABELS,
	MACHINE_TIER_LABELS,
	MACHINE_TIER_ORDER,
} from './listing-format.ts';

const SORT_COLUMNS = ['name', 'state', 'tier', 'price', 'updated'] as const;

export type HostListingSortColumn = (typeof SORT_COLUMNS)[number];

const SORT_LABELS: Record<HostListingSortColumn, string> = {
	name: 'Machine',
	state: 'State',
	tier: 'Tier',
	price: 'Price',
	updated: 'Last updated',
};

export const HOST_LISTING_SORT_OPTIONS: readonly ResourceSortOption[] =
	SORT_COLUMNS.map((column) => ({ id: column, label: SORT_LABELS[column] }));

export const HOST_LISTING_STATE_OPTIONS: ChipOption<ListingState>[] =
	HOST_LISTING_STATE_ORDER.map((state) => ({
		label: LISTING_STATE_LABELS[state],
		value: state,
	}));

export const HOST_LISTING_VISIBILITY_OPTIONS: ChipOption<ListingVisibility>[] =
	Object.values(ListingVisibility).map((visibility) => ({
		label: LISTING_VISIBILITY_LABELS[visibility],
		value: visibility,
	}));

export const HOST_LISTING_TIER_OPTIONS: ChipOption<MachineTier>[] =
	MACHINE_TIER_ORDER.map((tier) => ({
		label: MACHINE_TIER_LABELS[tier],
		value: tier,
	}));

export const hostListingSchema = z.object({
	search: z.string().catch(''),
	state: searchParamArray(z.enum(ListingState)).catch([]),
	visibility: searchParamArray(z.enum(ListingVisibility)).catch([]),
	tier: searchParamArray(z.enum(MachineTier)).catch([]),
	sort: z.enum(SORT_COLUMNS).nullable().catch(null),
	dir: z.enum(['asc', 'desc']).catch('desc'),
});

export type HostListingParams = SearchParamsValues<typeof hostListingSchema>;

export type HostListingFilterKey = 'state' | 'visibility' | 'tier';

export type HostListingFilterPatch = Partial<
	Pick<HostListingParams, HostListingFilterKey>
>;

export const CLEARED_HOST_LISTING_FILTERS = {
	state: [],
	visibility: [],
	tier: [],
} as const satisfies HostListingFilterPatch;

export function isHostListingSortColumn(
	column: string
): column is HostListingSortColumn {
	return SORT_COLUMNS.some((candidate) => candidate === column);
}

export function isListingState(value: string): value is ListingState {
	return Object.values<string>(ListingState).includes(value);
}

export function isListingVisibility(value: string): value is ListingVisibility {
	return Object.values<string>(ListingVisibility).includes(value);
}

export function isMachineTier(value: string): value is MachineTier {
	return Object.values<string>(MachineTier).includes(value);
}

export function listingStateRank(machine: HostMachine): number {
	return HOST_LISTING_STATE_ORDER.indexOf(machine.listing.state);
}

export function listingTierRank(machine: HostMachine): number {
	return MACHINE_TIER_ORDER.indexOf(machine.tier);
}

export function listingPriceValue(machine: HostMachine): number {
	const card = machine.currentPriceCard;
	return card ? Number(card.referencePriceMicroUsd) : -1;
}

export function listingUpdatedValue(machine: HostMachine): number {
	return Date.parse(machine.listing.updatedAt);
}

function matchesSearch(machine: HostMachine, query: string): boolean {
	return (
		!query ||
		machine.machineId.toLowerCase().includes(query) ||
		machine.name.toLowerCase().includes(query) ||
		formatListingSpecs(machine).toLowerCase().includes(query)
	);
}

export function filterHostMachines(
	machines: readonly HostMachine[],
	params: HostListingParams
): HostMachine[] {
	const query = params.search.trim().toLowerCase();
	return machines
		.filter(
			(machine) =>
				(params.state.length === 0 ||
					params.state.includes(machine.listing.state)) &&
				(params.visibility.length === 0 ||
					params.visibility.includes(machine.listing.visibility)) &&
				(params.tier.length === 0 || params.tier.includes(machine.tier)) &&
				matchesSearch(machine, query)
		)
		.toSorted(
			(left, right) =>
				listingStateRank(left) - listingStateRank(right) ||
				left.name.localeCompare(right.name)
		);
}

export interface HostListingFilterTag {
	key: HostListingFilterKey;
	label: string;
}

export function hostListingFilterTags(
	params: HostListingParams
): HostListingFilterTag[] {
	const tags: HostListingFilterTag[] = [];
	if (params.state.length > 0) {
		tags.push({
			key: 'state',
			label: `State: ${params.state.map((state) => LISTING_STATE_LABELS[state]).join(', ')}`,
		});
	}
	if (params.visibility.length > 0) {
		tags.push({
			key: 'visibility',
			label: `Visibility: ${params.visibility.map((visibility) => LISTING_VISIBILITY_LABELS[visibility]).join(', ')}`,
		});
	}
	if (params.tier.length > 0) {
		tags.push({
			key: 'tier',
			label: `Tier: ${params.tier.map((tier) => MACHINE_TIER_LABELS[tier]).join(', ')}`,
		});
	}
	return tags;
}
