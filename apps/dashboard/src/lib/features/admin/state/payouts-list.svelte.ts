/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import RotateCw from '@lucide/svelte/icons/rotate-cw';
import type { Payout } from '@snapflow/api-client';
import {
	createInfiniteQuery,
	createMutation,
	keepPreviousData,
} from '@tanstack/svelte-query';
import {
	adminPayoutsInfiniteQueryOptions,
	retryAdminPayoutMutationOptions,
} from '#lib/api/admin/payouts.ts';
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
	isRetryable,
	PAYOUT_FILTER_KEYS,
	PAYOUT_SORT_OPTIONS,
	PAYOUT_STATE_OPTIONS,
	payoutsSearchSchema,
} from '#lib/features/admin/lib/payouts-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class PayoutsList {
	readonly #params = new SearchParams(payoutsSearchSchema);
	readonly #serverState = $derived.by(() =>
		this.#params.current.state.length === 1
			? this.#params.current.state[0]
			: undefined
	);

	readonly controls = new AdminListControls(this.#params, {
		sortOptions: PAYOUT_SORT_OPTIONS,
		filterKeys: PAYOUT_FILTER_KEYS,
		filterFields: () => [
			adminFilter({
				id: 'state',
				label: 'State',
				options: PAYOUT_STATE_OPTIONS,
				values: this.#params.current.state,
				onChange: (state) => void this.#params.update({ state }),
			}),
		],
	});
	readonly payoutsQuery = createInfiniteQuery(() => ({
		...adminPayoutsInfiniteQueryOptions({
			limit: ADMIN_PAGE_SIZE,
			state: this.#serverState,
		}),
		...adminCursorPages,
		placeholderData: keepPreviousData,
	}));
	readonly retry = createMutation(() => retryAdminPayoutMutationOptions());

	readonly #loaded: Payout[] = $derived.by(() =>
		adminPageItems(this.payoutsQuery.data)
	);
	readonly payouts: readonly Payout[] = $derived.by(() =>
		this.#loaded.filter(
			(payout) =>
				matchesSearch(this.controls.search.value, [
					payout.id,
					payout.organizationId,
					payout.batchId,
					payout.stripeTransferId,
				]) && matchesFilter(this.#params.current.state, payout.state)
		)
	);
	readonly #payoutsById = $derived.by(
		() => new Map(this.#loaded.map((payout) => [payout.id, payout]))
	);
	readonly panel = new OpenRowParam(
		() => this.payouts,
		(payout) => payout.id
	);

	payoutActions = (payout: Payout): ResourceRowAction[] => [
		{
			icon: RotateCw,
			label: 'Retry transfer',
			onSelect: () => this.retry.mutate(payout.id),
			disabled: this.retry.isPending,
			visible: isRetryable(payout),
		},
		{ icon: Copy, label: 'Copy ID', onSelect: () => copyId(payout.id) },
		{
			icon: Copy,
			label: 'Copy organization ID',
			onSelect: () => copyId(payout.organizationId),
		},
	];

	payoutRowActions = (payoutId: string): ResourceRowAction[] => {
		const payout = this.#payoutsById.get(payoutId);
		return payout ? this.payoutActions(payout) : [];
	};
}
