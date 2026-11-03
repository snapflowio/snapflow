/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import type { AdminPaymentDispute } from '@snapflow/api-client';
import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { adminDisputesInfiniteQueryOptions } from '#lib/api/admin/disputes.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { adminFilter } from '#lib/features/admin/lib/admin-filters.ts';
import {
	ADMIN_PAGE_SIZE,
	adminCursorPages,
	adminPageItems,
	copyId,
	matchesFilter,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import {
	DISPUTE_FILTER_KEYS,
	DISPUTE_SORT_OPTIONS,
	DISPUTE_STATE_OPTIONS,
	disputesSearchSchema,
} from '#lib/features/admin/lib/disputes-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class DisputesList {
	readonly #params = new SearchParams(disputesSearchSchema);
	readonly #serverState = $derived.by(() =>
		this.#params.current.state.length === 1
			? this.#params.current.state[0]
			: undefined
	);

	readonly controls = new AdminListControls(this.#params, {
		sortOptions: DISPUTE_SORT_OPTIONS,
		filterKeys: DISPUTE_FILTER_KEYS,
		filterFields: () => [
			adminFilter({
				id: 'state',
				label: 'State',
				options: DISPUTE_STATE_OPTIONS,
				values: this.#params.current.state,
				onChange: (state) => void this.#params.update({ state }),
			}),
		],
	});
	readonly disputesQuery = createInfiniteQuery(() => ({
		...adminDisputesInfiniteQueryOptions({
			limit: ADMIN_PAGE_SIZE,
			state: this.#serverState,
		}),
		...adminCursorPages,
		placeholderData: keepPreviousData,
	}));

	readonly #loaded: AdminPaymentDispute[] = $derived.by(() =>
		adminPageItems(this.disputesQuery.data)
	);
	readonly disputes: readonly AdminPaymentDispute[] = $derived.by(() =>
		this.#loaded.filter(
			(dispute) =>
				matchesSearch(this.controls.search.value, [
					dispute.id,
					dispute.organizationId,
					dispute.stripeDisputeId,
					dispute.topUpId,
					dispute.reason,
				]) && matchesFilter(this.#params.current.state, dispute.state)
		)
	);
	readonly #disputesById = $derived.by(
		() => new Map(this.#loaded.map((dispute) => [dispute.id, dispute]))
	);
	readonly panel = new OpenRowParam(
		() => this.disputes,
		(dispute) => dispute.id
	);

	disputeActions = (dispute: AdminPaymentDispute): ResourceRowAction[] => [
		{
			icon: Copy,
			label: 'Copy Stripe dispute ID',
			onSelect: () => copyId(dispute.stripeDisputeId),
		},
		{
			icon: Copy,
			label: 'Copy organization ID',
			onSelect: () => copyId(dispute.organizationId),
		},
	];

	disputeRowActions = (disputeId: string): ResourceRowAction[] => {
		const dispute = this.#disputesById.get(disputeId);
		return dispute ? this.disputeActions(dispute) : [];
	};
}
