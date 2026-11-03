<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { payoutsInfiniteQueryOptions } from '#lib/api/billing/payouts.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import {
	CURSOR_PAGE_SIZE,
	cursorPageItems,
	nextCursorPage,
} from '#lib/features/billing/lib/infinite-cursor.ts';
import PayoutsTable from './payouts-table.svelte';

const payouts = createInfiniteQuery(() => ({
	...payoutsInfiniteQueryOptions({ limit: CURSOR_PAGE_SIZE }),
	initialPageParam: {},
	getNextPageParam: nextCursorPage,
	placeholderData: keepPreviousData,
}));
</script>

{#snippet empty()}
	<EmptyState
		title="No payouts yet"
		description="Available earnings are paid out weekly once they reach the minimum."
	/>
{/snippet}

<PayoutsTable
	errorMessage={payouts.isError ? 'Failed to load payouts' : undefined}
	isLoading={payouts.isLoading}
	onRetry={() => void payouts.refetch()}
	payouts={cursorPageItems(payouts.data)}
	{empty}
	hasMore={payouts.hasNextPage}
	loadingMore={payouts.isFetchingNextPage}
	onLoadMore={() => void payouts.fetchNextPage()}
/>
