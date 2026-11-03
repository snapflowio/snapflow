/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type ListAdminListingsData,
	type ListVerificationReviewsData,
	type ResolveVerificationReview,
	resolveVerificationReview,
	type UpdateAdminMachineTier,
	updateAdminMachineTier,
	updateMarketReferencePrice,
} from '@snapflow/api-client';
import {
	listAdminListingsInfiniteOptions,
	listAdminListingsQueryKey,
	listMarketReferencePricesOptions,
	listMarketReferencePricesQueryKey,
	listVerificationReviewsInfiniteOptions,
	listVerificationReviewsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';

interface TierChange {
	change: UpdateAdminMachineTier;
	machineId: string;
}

interface ReviewResolution {
	resolution: ResolveVerificationReview;
	reviewId: string;
}

interface ReferencePriceChange {
	bootstrapMedianMicroUsd: string;
	priceClass: string;
}

export function adminListingsInfiniteQueryOptions(
	query: ListAdminListingsData['query']
) {
	return listAdminListingsInfiniteOptions({ query });
}

export function verificationReviewsInfiniteQueryOptions(
	query: ListVerificationReviewsData['query']
) {
	return listVerificationReviewsInfiniteOptions({ query });
}

export function referencePricesQueryOptions() {
	return listMarketReferencePricesOptions();
}

export function updateMachineTierMutationOptions() {
	return mutationOptions({
		mutationFn: ({ change, machineId }: TierChange) =>
			updateAdminMachineTier({ path: { machineId }, body: change }),
		meta: {
			success: 'Machine tier updated',
			failure: 'Failed to update the tier',
			invalidates: [listAdminListingsQueryKey()],
		},
	});
}

export function resolveReviewMutationOptions() {
	return mutationOptions({
		mutationFn: ({ resolution, reviewId }: ReviewResolution) =>
			resolveVerificationReview({ path: { reviewId }, body: resolution }),
		meta: {
			success: 'Review resolved',
			failure: 'Failed to resolve the review',
			invalidates: [listVerificationReviewsQueryKey()],
		},
	});
}

export function updateReferencePriceMutationOptions() {
	return mutationOptions({
		mutationFn: ({
			bootstrapMedianMicroUsd,
			priceClass,
		}: ReferencePriceChange) =>
			updateMarketReferencePrice({
				path: { priceClass },
				body: { bootstrapMedianMicroUsd },
			}),
		meta: {
			success: 'Reference price saved',
			failure: 'Failed to save the reference price',
			invalidates: [listMarketReferencePricesQueryKey()],
		},
	});
}
