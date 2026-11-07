<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { EscrowEventKind, SettlementParty } from '@snapflow/api-client';
import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { escrowEventsInfiniteQueryOptions } from '#lib/api/settlement/escrow.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import {
	CURSOR_PAGE_SIZE,
	cursorPageItems,
	nextCursorPage,
} from '#lib/features/billing/lib/infinite-cursor.ts';
import EscrowEventsTable from './escrow-events-table.svelte';

interface EscrowEventHistoryProps {
	caption: string;
	party: SettlementParty;
	kinds?: EscrowEventKind[];
	emptyTitle: string;
	emptyDescription: string;
}

let {
	caption,
	party,
	kinds,
	emptyTitle,
	emptyDescription,
}: EscrowEventHistoryProps = $props();

const events = createInfiniteQuery(() => ({
	...escrowEventsInfiniteQueryOptions({
		limit: CURSOR_PAGE_SIZE,
		role: party,
		kind: kinds,
	}),
	initialPageParam: {},
	getNextPageParam: nextCursorPage,
	placeholderData: keepPreviousData,
}));
const rows = $derived(cursorPageItems(events.data));
</script>

{#snippet empty()}
	<EmptyState title={emptyTitle} description={emptyDescription} />
{/snippet}

<EscrowEventsTable
	{caption}
	events={rows}
	{party}
	errorMessage={events.isError
		? `Failed to load ${caption.toLowerCase()}`
		: undefined}
	isLoading={events.isLoading}
	onRetry={() => void events.refetch()}
	{empty}
	emptyMessage={emptyTitle}
	hasMore={events.hasNextPage}
	loadingMore={events.isFetchingNextPage}
	onLoadMore={() => void events.fetchNextPage()}
/>
