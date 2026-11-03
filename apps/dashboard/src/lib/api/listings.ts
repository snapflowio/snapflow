/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreatePriceCard,
	createMachinePriceCard,
	type GetListingData,
	type HostMachine,
	type ListListingsData,
	listHostMachines,
	MachineBrowseSort,
	requestMachineBenchmark,
	type UpdateMachineListing,
	updateMachineListing,
} from '@snapflow/api-client';
import {
	getListingOptions,
	getMachinePriceFloorOptions,
	getMachinePriceFloorQueryKey,
	getMachineVerificationOptions,
	getMachineVerificationQueryKey,
	listHostMachinesQueryKey,
	listListingsInfiniteOptions,
	listListingsOptions,
	listListingsQueryKey,
	listMachinePriceCardsOptions,
	listMachinePriceCardsQueryKey,
} from '@snapflow/api-client/svelte-query';
import {
	keepPreviousData,
	mutationOptions,
	queryOptions,
} from '@tanstack/svelte-query';
import {
	idempotencyHeaders,
	ifMatchHeaders,
} from '#lib/api/client/api-client.ts';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';

export interface ListingChange {
	listing: UpdateMachineListing;
	machine: HostMachine;
}

export interface PriceCardChange {
	machineId: string;
	rates: CreatePriceCard;
}

const MACHINE_LIST_KEYS = [listHostMachinesQueryKey(), listListingsQueryKey()];
const PLACEMENT_MACHINE_LIMIT = 100;

export function listingsQueryOptions(query: ListListingsData['query']) {
	return queryOptions({
		...listListingsOptions({ query }),
		placeholderData: keepPreviousData,
	});
}

export function listingsInfiniteQueryOptions(query: ListListingsData['query']) {
	return listListingsInfiniteOptions({ query });
}

export function placementListingsQueryOptions() {
	return listListingsOptions({
		query: {
			limit: PLACEMENT_MACHINE_LIMIT,
			sort: MachineBrowseSort.Price,
		},
	});
}

export function listingQueryOptions(
	machineId: string,
	query?: GetListingData['query']
) {
	return getListingOptions({ path: { machineId }, query });
}

export function machinePriceFloorQueryOptions(machineId: string) {
	return queryOptions({
		...getMachinePriceFloorOptions({ path: { machineId } }),
		retry: false,
	});
}

export function machinePriceCardsQueryOptions(machineId: string) {
	return listMachinePriceCardsOptions({ path: { machineId } });
}

export function machineVerificationQueryOptions(machineId: string) {
	return getMachineVerificationOptions({ path: { machineId } });
}

export function allHostMachinesQueryOptions() {
	return allPagesOptions(
		listHostMachinesQueryKey(),
		async (cursor, signal) =>
			(await listHostMachines({ query: { cursor }, signal })).data
	);
}

export function updateListingMutationOptions() {
	return mutationOptions({
		mutationFn: ({ listing, machine }: ListingChange) =>
			updateMachineListing({
				path: { machineId: machine.machineId },
				body: listing,
				headers: ifMatchHeaders(machine.listing.version),
			}),
		meta: {
			invalidates: MACHINE_LIST_KEYS,
			success: 'Listing updated',
			failure: 'Failed to update the listing',
		},
	});
}

export function publishPriceCardMutationOptions() {
	return mutationOptions({
		mutationFn: async ({ machineId, rates }: PriceCardChange) => {
			await createMachinePriceCard({
				path: { machineId },
				body: rates,
				headers: idempotencyHeaders(),
			});
			return machineId;
		},
		onSuccess: (machineId, _change, _result, { client }) =>
			Promise.all([
				client.invalidateQueries({
					queryKey: listMachinePriceCardsQueryKey({ path: { machineId } }),
				}),
				client.invalidateQueries({
					queryKey: getMachinePriceFloorQueryKey({ path: { machineId } }),
				}),
			]),
		meta: { invalidates: MACHINE_LIST_KEYS, success: 'Prices published' },
	});
}

export function requestBenchmarkMutationOptions() {
	return mutationOptions({
		mutationFn: async (machineId: string) => {
			await requestMachineBenchmark({ path: { machineId } });
			return machineId;
		},
		onSuccess: (machineId, _machineId, _result, { client }) =>
			client.invalidateQueries({
				queryKey: getMachineVerificationQueryKey({ path: { machineId } }),
			}),
		meta: {
			success: 'Benchmark requested',
			failure: 'Failed to request a benchmark',
		},
	});
}
