/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type VerificationReview,
	VerificationReviewKind,
	VerificationReviewState,
} from '@snapflow/api-client';
import * as z from 'zod';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { VERIFICATION_REVIEW_KIND_LABELS } from '#lib/features/admin/lib/verification-review.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';

const ALL_REVIEWS = 'all';

export const REVIEW_STATE_OPTIONS = [
	{ label: 'Open', value: VerificationReviewState.Open },
];

export const REVIEW_SORT_OPTIONS = [
	{ id: 'opened', label: 'Opened' },
	{ id: 'resolved', label: 'Resolved' },
] as const;

export const REVIEW_KIND_OPTIONS = Object.values(VerificationReviewKind).map(
	(kind) => ({
		label: VERIFICATION_REVIEW_KIND_LABELS[kind],
		value: kind,
	})
);

export const REVIEW_FILTER_KEYS = ['kind', 'state'] as const;

export const REVIEW_CLEARED_FILTERS = { state: ALL_REVIEWS } as const;

export const REVIEW_EMPTY_MESSAGES = {
	[VerificationReviewState.Open]: 'No findings need a decision',
	[ALL_REVIEWS]: 'No findings yet',
} as const;

export const reviewsSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['opened', 'resolved']),
	state: z
		.enum([VerificationReviewState.Open, ALL_REVIEWS])
		.catch(VerificationReviewState.Open),
	kind: searchParamArray(z.enum(VerificationReviewKind)).catch([]),
});

export function isOpenReview(review: VerificationReview): boolean {
	return review.state === VerificationReviewState.Open;
}

export function showsOpenReviewsOnly(state: string): boolean {
	return state === VerificationReviewState.Open;
}

export function reviewStateFilterValues(
	state: string
): VerificationReviewState[] {
	return showsOpenReviewsOnly(state) ? [VerificationReviewState.Open] : [];
}

export function reviewStateFromFilter(
	values: readonly VerificationReviewState[]
): z.infer<typeof reviewsSearchSchema>['state'] {
	return values.length > 0 ? VerificationReviewState.Open : ALL_REVIEWS;
}
